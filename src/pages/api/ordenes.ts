import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import nodemailer from 'nodemailer';

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

        // --- TRANSACCIÓN ATÓMICA ---
        const orden = await prisma.$transaction(async (tx) => {
            for (const item of items) {
                // Solo restamos stock si NO es un boleto
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

            // CORRECCIÓN: Se eliminó el "await" redundante después del return
            return tx.orden.create({
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

        // --- ENVÍO DE COMPROBANTE ---
        const urlTicket = `https://chocolate-utc.vercel.app/ticket/${orden.id}`;
        const qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlTicket)}&color=1c1917`;

        if (email) {
            // CORRECCIÓN: Se ajustó el CSS (font-weight a 700 y background-color) para satisfacer al linter de WebStorm
            await transporter.sendMail({
                from: `"Museo de Chocolate" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: `Ticket de Acceso #${orden.id.slice(-6).toUpperCase()}`,
                html: `
                    <div style="font-family: serif; background-color: #fcfaf8; padding: 40px; text-align: center; border-radius: 20px;">
                        <h1 style="color: #7c2d12; font-style: italic;">Museo de Chocolate</h1>
                        <p>¡Gracias por tu compra, <strong>${clienteNombre}</strong>!</p>
                        <div style="margin: 30px 0;">
                            <img src="${qrCodeDataURL}" width="150" alt="QR" />
                        </div>
                        <a href="${urlTicket}" style="background-color: #1c1917; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-size: 12px; font-weight: 700;">VER MI TICKET DIGITAL</a>
                        <p style="font-size: 10px; color: #a8a29e; margin-top: 30px;">ID de Orden: ${orden.id}</p>
                    </div>
                `
            });
        }

        return new Response(JSON.stringify({ success: true, orden }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}