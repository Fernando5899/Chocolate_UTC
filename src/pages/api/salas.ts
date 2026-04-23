import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { nombre, descripcion, imagenUrl, historia } = body;

        // Validamos que vengan los datos mínimos
        if (!nombre || !descripcion || !imagenUrl) {
            return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400 });
        }

        // Guardamos en la base de datos usando Prisma
        const nuevaSala = await prisma.sala.create({
            data: {
                nombre,
                descripcion,
                imagenUrl,
                historia: historia || "" // Campo opcional
            }
        });

        return new Response(JSON.stringify(nuevaSala), { status: 201 });
    } catch (error: any) {
        console.error("Error al crear sala:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return new Response(JSON.stringify({ error: 'Falta el ID de la sala' }), { status: 400 });
        }

        // Le decimos a Prisma que borre la sala con ese ID exacto
        await prisma.sala.delete({
            where: { id }
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        console.error("Error al eliminar sala:", error);
        return new Response(JSON.stringify({ error: 'No se pudo eliminar la sala' }), { status: 500 });
    }
};

// Bonus: GET para listar salas si lo necesitamos después
export const GET: APIRoute = async () => {
    try {
        const salas = await prisma.sala.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return new Response(JSON.stringify(salas), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};