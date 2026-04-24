import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import nodemailer from 'nodemailer';

// 1. Configuramos el "transporter" (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { clienteNombre, email, estadoEnvio, direccion, codigoPostal, total, items, userId } = body;

        // --- TRANSACCIÓN DE PRISMA (Tu lógica de stock intacta) ---
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

        // --- LÓGICA DE CORREO Y QR PROFESIONAL ---
        let correoDestino = email;
        if (userId) {
            const usuarioDb = await prisma.user.findUnique({ where: { id: userId } });
            if (usuarioDb?.email) correoDestino = usuarioDb.email;
        }

        if (correoDestino) {
            // URL dinámica de tu ticket en Vercel
            const urlTicket = `https://chocolate-utc.vercel.app//ticket/${orden.id}`;

            // Generamos el QR apuntando a la URL del ticket profesional
            const qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(urlTicket)}&color=1c1917&bgcolor=ffffff`;

            const listaArticulosHTML = items.map((item: any) =>
                `<tr style="border-bottom: 1px solid #f5f5f4;">
                    <td style="padding: 12px 0; font-family: serif; color: #1c1917;"><em>${item.cantidad}x</em> ${item.nombre}</td>
                    <td style="padding: 12px 0; text-align: right; font-family: monospace; color: #78716c;">$${(item.precio * item.cantidad).toFixed(2)}</td>
                </tr>`
            ).join('');

            // Enviar correo
            await transporter.sendMail({
                from: `"Museo de Chocolate" <${process.env.GMAIL_USER}>`,
                to: correoDestino,
                subject: `Tu Manifiesto de Expedición #${orden.id.slice(-6).toUpperCase()}`,
                html: `
                    <div style="background-color: #fcfaf8; padding: 40px 20px; font-family: 'Georgia', serif;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                            
                            <div style="background-color: #1c1917; padding: 40px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-style: italic; font-size: 28px;">Museo de Chocolate</h1>
                                <p style="color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-size: 10px; margin-top: 10px;">Cultura, Historia y Sabor</p>
                            </div>

                            <div style="padding: 40px;">
                                <h2 style="color: #1c1917; font-size: 22px; margin-bottom: 16px;">¡Gracias por tu visita, ${clienteNombre}!</h2>
                                <p style="color: #57534e; line-height: 1.6; font-size: 15px;">Hemos preparado tu selección artesanal. Tu orden ha sido registrada exitosamente en nuestra tesorería digital.</p>

                                <table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                    <thead>
                                        <tr style="border-bottom: 2px solid #1c1917;">
                                            <th style="text-align: left; padding-bottom: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #78716c;">Artículo</th>
                                            <th style="text-align: right; padding-bottom: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #78716c;">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${listaArticulosHTML}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td style="padding-top: 20px; font-weight: bold; color: #1c1917;">TOTAL FINAL</td>
                                            <td style="padding-top: 20px; text-align: right; font-size: 24px; font-weight: black; color: #c2410c;">$${total.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                <div style="text-align: center; background-color: #fcfaf8; border: 1px dashed #d6d3d1; padding: 40px; border-radius: 20px; margin-top: 40px;">
                                    <p style="font-size: 11px; font-weight: bold; color: #c2410c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;">Tu Pase Digital de Acceso</p>
                                    <img src="${qrCodeDataURL}" width="180" height="180" alt="QR de Acceso" style="border-radius: 12px; border: 8px solid white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" />
                                    <p style="font-size: 12px; color: #78716c; margin-top: 20px;">Escanea este código o haz clic en el botón de abajo para ver tu ticket profesional.</p>
                                    
                                    <a href="${urlTicket}" style="display: inline-block; margin-top: 20px; background-color: #1c1917; color: #ffffff; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Ver Ticket Digital</a>
                                </div>
                            </div>

                            <div style="background-color: #fcfaf8; padding: 20px; text-align: center; border-top: 1px solid #e7e5e4;">
                                <p style="color: #a8a29e; font-size: 10px; font-style: italic;">ID de Expedición: ${orden.id}</p>
                            </div>
                        </div>
                    </div>
                `
            });
        }

        return new Response(JSON.stringify({ success: true, orden }), { status: 200 });
    } catch (error: any) {
        console.error("Error en ordenes API:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}