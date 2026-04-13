import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { clienteNombre, email, estadoEnvio, direccion, codigoPostal, total, items, userId } = body;

        const orden = await prisma.$transaction(async (tx) => {
            for (const item of items) {
                if (!item.id.includes('ticket')) {
                    const chocolateDb = await tx.chocolate.findUnique({ where: { id: item.id } });
                    if (!chocolateDb) throw new Error(`Producto ${item.nombre} no encontrado.`);
                    if (chocolateDb.stock < item.cantidad) throw new Error(`Stock insuficiente de ${item.nombre}.`);

                    await tx.chocolate.update({
                        where: { id: item.id },
                        data: { stock: chocolateDb.stock - item.cantidad }
                    });
                }
            }

            return await tx.orden.create({
                data: {
                    clienteNombre, estadoEnvio, direccion, codigoPostal, total,
                    userId: userId || null,
                    detalles: {
                        create: items
                            .filter((i: any) => !i.id.includes('ticket'))
                            .map((item: any) => ({
                                chocolateId: item.id,
                                cantidad: item.cantidad,
                                precioUnit: item.precio
                            }))
                    }
                }
            });
        });

        // --- LÓGICA DE CORREO Y QR ---
        let correoDestino = email;
        if (userId) {
            const usuarioDb = await prisma.user.findUnique({ where: { id: userId } });
            if (usuarioDb?.email) correoDestino = usuarioDb.email;
        }

        if (correoDestino) {
            const tieneBoletos = items.some((i: any) => i.id.includes('ticket'));
            let qrCodeDataURL = "";

            if (tieneBoletos) {
                // SOLUCIÓN GMAIL: Usamos una API externa que devuelve una imagen real, no un Base64
                qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orden.id}`;
            }

            const listaArticulosHTML = items.map((item: any) =>
                `<li style="margin-bottom: 8px; color: #444;">
                    <strong>${item.cantidad}x</strong> ${item.nombre} - $${(item.precio * item.cantidad).toFixed(2)}
                </li>`
            ).join('');

            await resend.emails.send({
                from: 'Museo de Chocolate <onboarding@resend.dev>',
                to: [correoDestino],
                subject: `Comprobante de Expedición #${orden.id.slice(-6).toUpperCase()}`,
                html: `
                    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background-color: #fcfaf8; padding: 40px; border: 1px solid #e7e5e4; border-radius: 16px;">
                        <h1 style="color: #c2410c; font-style: italic; text-align: center; margin-bottom: 8px;">Museo de Chocolate</h1>
                        <p style="text-align: center; color: #78716c; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Cultura y Tradición</p>
                        
                        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 30px 0;" />
                        
                        <h2 style="color: #1c1917;">¡Confirmado, ${clienteNombre}!</h2>
                        <p style="color: #57534e; line-height: 1.6;">Tu solicitud ha sido procesada. Aquí tienes el manifiesto de tu expedición:</p>
                        
                        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px dashed #d6d3d1; margin: 24px 0;">
                            <p style="font-size: 12px; color: #78716c; text-transform: uppercase;">Folio: <strong>#${orden.id.slice(-6).toUpperCase()}</strong></p>
                            <ul style="list-style: none; padding: 0; margin: 0;">${listaArticulosHTML}</ul>
                            <p style="font-size: 18px; color: #1c1917; text-align: right; margin-top: 15px;">Total: <strong>$${total.toFixed(2)}</strong></p>
                        </div>

                        ${tieneBoletos ? `
                            <div style="text-align: center; margin-top: 30px; padding: 20px; border: 1px solid #e7e5e4; border-radius: 12px; background: white;">
                                <p style="font-weight: bold; color: #c2410c; margin-bottom: 10px;">TU ACCESO DIGITAL</p>
                                <img src="${qrCodeDataURL}" width="150" height="150" alt="Código QR de Acceso" />
                                <p style="font-size: 10px; color: #a8a29e; margin-top: 10px;">Muestra este código en la entrada del museo.</p>
                            </div>
                        ` : ''}
                        
                        <p style="color: #a8a29e; font-size: 11px; text-align: center; margin-top: 40px; font-style: italic;">Este es un recibo automático generado por el sistema de tesorería del museo.</p>
                    </div>
                `
            });
        }

        return new Response(JSON.stringify({ success: true, orden }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}