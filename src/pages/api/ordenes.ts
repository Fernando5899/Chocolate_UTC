import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { clienteNombre, estadoEnvio, direccion, codigoPostal, total, items, userId } = body;

        // 1. INICIAMOS LA TRANSACCIÓN (Seguridad Anti-Bots y Concurrencia)
        const orden = await prisma.$transaction(async (tx) => {

            // A. VERIFICACIÓN Y DESCUENTO DE STOCK
            for (const item of items) {
                // Filtramos: Solo descontamos stock si es un Chocolate (los boletos tienen la palabra 'ticket' en su ID)
                if (!item.id.includes('ticket')) {
                    const chocolateDb = await tx.chocolate.findUnique({ where: { id: item.id } });

                    if (!chocolateDb) {
                        throw new Error(`El producto ${item.nombre} ya no está disponible en el museo.`);
                    }
                    if (chocolateDb.stock < item.cantidad) {
                        throw new Error(`Stock insuficiente de ${item.nombre}. Solo quedan ${chocolateDb.stock} unidades.`);
                    }

                    // DESCONTAMOS EL INVENTARIO EN POSTGRESQL
                    await tx.chocolate.update({
                        where: { id: item.id },
                        data: { stock: chocolateDb.stock - item.cantidad }
                    });
                }
            }

            // B. CREACIÓN DE LA ORDEN EN EL HISTORIAL
            const nuevaOrden = await tx.orden.create({
                data: {
                    clienteNombre,
                    estadoEnvio,
                    direccion,
                    codigoPostal,
                    total,
                    // Si la variable userId marca error en rojo aquí, es 100% la caché de WebStorm
                    userId: userId || null,
                    detalles: {
                        create: items
                            // Filtro de seguridad: PostgreSQL exige un 'chocolateId' válido
                            .filter((i: any) => !i.id.includes('ticket'))
                            .map((item: any) => ({
                                chocolateId: item.id,
                                cantidad: item.cantidad,
                                precioUnit: item.precio
                            }))
                    }
                }
            });

            return nuevaOrden;
        });

        // 2. RESPUESTA EXITOSA AL CHECKOUT
        return new Response(JSON.stringify({ success: true, orden }), { status: 200 });

    } catch (error: any) {
        // 3. SI EL STOCK FALLA, RECHAZAMOS LA COMPRA
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}