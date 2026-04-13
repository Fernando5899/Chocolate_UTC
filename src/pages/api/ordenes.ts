import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { clienteNombre, estadoEnvio, direccion, codigoPostal, total, items } = body;

        // Usamos una Transacción para asegurar la integridad de la base de datos
        const resultado = await prisma.$transaction(async (tx) => {

            // 1. Creamos la orden principal y sus detalles en un solo movimiento
            const nuevaOrden = await tx.orden.create({
                data: {
                    clienteNombre,
                    estadoEnvio,
                    direccion,
                    codigoPostal,
                    total,
                    detalles: {
                        create: items.map((item: any) => ({
                            chocolateId: item.id,
                            cantidad: item.cantidad,
                            precioUnit: item.precio
                        }))
                    }
                }
            });

            return nuevaOrden;
        });

        // Le decimos al navegador que todo salió excelente (Código 201: Creado)
        return new Response(JSON.stringify(resultado), { status: 201 });

    } catch (error) {
        console.error("🚨 Error al guardar la orden:", error);
        return new Response(JSON.stringify({ error: 'Error interno al procesar la orden' }), { status: 500 });
    }
}