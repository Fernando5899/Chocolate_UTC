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

        // --- TRANSACCIÓN ATÓMICA BLINDADA ---
        const orden = await prisma.$transaction(async (tx) => {
            for (const item of items) {
                // Detectamos si es boleto para no intentar restarlo del inventario físico
                const esBoleto = item.id.includes('ticket') || item.id.includes('boleto');

                if (!esBoleto) {
                    try {
                        // 🛡️ EL BLINDAJE: Hacemos el UPDATE y la validación en un solo movimiento atómico
                        await tx.chocolate.update({
                            where: { 
                                id: item.id,
                                stock: { gte: item.cantidad } // Solo actualiza si hay stock suficiente en este milisegundo exacto
                            },
                            data: { 
                                stock: { decrement: item.cantidad } // Delega la matemática directamente a PostgreSQL
                            }
                        });
                    } catch (error) {
                        // Si Prisma no encuentra el registro que cumpla ambas condiciones, lanza este error
                        throw new Error(`¡Ups! Alguien se te adelantó. El inventario de "${item.nombre}" se agotó mientras procesábamos tu pago.`);
                    }
                }
            }

            // CREACIÓN DE LA ORDEN Y MANIFIESTO
            return tx.orden.create({
                data: {
                    clienteNombre, estadoEnvio, direccion, codigoPostal, total,
                    userId: userId || null,
                    detalles: {
                        create: items.map((item: any) => {
                            const esBoleto = item.id.includes('ticket') || item.id.includes('boleto');

                            return {
                                chocolateId: esBoleto ? null : item.id,
                                nombreItem: esBoleto ? item.nombre : null, // Guardamos el nombre "Pase General", etc.
                                cantidad: item.cantidad,
                                precioUnit: item.precio
                            };
                        })
                    }
                }
            });
        });

        // --- ENVÍO DE COMPROBANTE ---
        const urlTicket = `https://chocolate-utc.vercel.app/ticket/${orden.id}`;
        const qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlTicket)}&color=1c1917`;

        if (email) {
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