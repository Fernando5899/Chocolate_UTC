import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import nodemailer from 'nodemailer';
import { getSession } from 'auth-astro/server';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

export const POST: APIRoute = async ({ request }) => {
    try {
        // 1. VALIDACIÓN DE SESIÓN (REGLA DE NEGOCIO OBLIGATORIA)
        const session = await getSession(request);

        if (!session || !session.user || !session.user.id) {
            return new Response(
                JSON.stringify({ error: 'Acceso denegado. Debes iniciar sesión para realizar una compra.' }),
                { status: 401 }
            );
        }

        const body = await request.json();
        // Extraemos los datos del cuerpo, pero ignoramos el userId que venga de ahí por seguridad
        const { clienteNombre, email, estadoEnvio, direccion, codigoPostal, total, items } = body;

        // --- TRANSACCIÓN ATÓMICA BLINDADA ---
        const orden = await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const esBoleto = item.id.includes('ticket') || item.id.includes('boleto');

                if (!esBoleto) {
                    try {
                        // Actualización atómica del inventario
                        await tx.chocolate.update({
                            where: {
                                id: item.id,
                                stock: { gte: item.cantidad }
                            },
                            data: {
                                stock: { decrement: item.cantidad }
                            }
                        });
                    } catch (error) {
                        throw new Error(`Inventario insuficiente para "${item.nombre}".`);
                    }
                }
            }

            // CREACIÓN DE LA ORDEN VINCULADA AL USUARIO
            return tx.orden.create({
                data: {
                    clienteNombre,
                    estadoEnvio,
                    direccion,
                    codigoPostal,
                    total,
                    // Usamos el ID verificado de la sesión de Auth.js
                    userId: session.user!.id,
                    detalles: {
                        create: items.map((item: any) => {
                            const esBoleto = item.id.includes('ticket') || item.id.includes('boleto');

                            return {
                                chocolateId: esBoleto ? null : item.id,
                                nombreItem: esBoleto ? item.nombre : null,
                                cantidad: item.cantidad,
                                precioUnit: item.precio
                            };
                        })
                    }
                }
            });
        });

        // --- GENERACIÓN DE TICKET Y ENVÍO DE CORREO ---
        const urlTicket = `https://chocolate-utc.vercel.app/ticket/${orden.id}`;
        const qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlTicket)}&color=1c1917`;

        if (email) {
            await transporter.sendMail({
                from: `"Museo de Chocolate" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: `Tu Ticket del Museo #${orden.id.slice(-6).toUpperCase()}`,
                html: `
                    <div style="font-family: sans-serif; background-color: #fcfaf8; padding: 40px; text-align: center; border-radius: 20px; border: 1px solid #e7e5e4;">
                        <h1 style="color: #7c2d12; font-style: italic;">Museo de Chocolate</h1>
                        <p style="color: #444;">¡Gracias por tu compra, <strong>${clienteNombre}</strong>!</p>
                        <div style="margin: 30px 0;">
                            <img src="${qrCodeDataURL}" width="180" alt="Código QR de acceso" />
                        </div>
                        <p style="font-size: 14px; color: #57534e;">Presenta este código en la entrada del museo.</p>
                        <br />
                        <a href="${urlTicket}" style="background-color: #1c1917; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold;">DESCARGAR TICKET DIGITAL</a>
                        <p style="font-size: 10px; color: #a8a29e; margin-top: 40px;">Orden ID: ${orden.id}</p>
                    </div>
                `
            });
        }

        return new Response(JSON.stringify({ success: true, orden }), { status: 200 });

    } catch (error: any) {
        console.error("Error en el procesamiento de orden:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}