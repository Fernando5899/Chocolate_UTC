import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { getSession } from 'auth-astro/server';

// Configuración de Cloudinary (Usa tus variables de .env)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Función para subir archivos a Cloudinary
async function subirACloudinary(file: File, carpeta: string): Promise<string | null> {
    if (!file || file.size === 0) return null;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;
        const resultado = await cloudinary.uploader.upload(base64Image, {
            folder: `museo_chocolate/${carpeta}`
        });
        return resultado.secure_url;
    } catch (error) {
        console.error("Error en Cloudinary:", error);
        return null;
    }
}

// Función para borrar de Cloudinary
async function borrarDeCloudinary(url: string) {
    if (!url) return;
    try {
        const parts = url.split('/upload/');
        if (parts.length === 2) {
            const urlSinVersion = parts[1].replace(/^v\d+\//, '');
            const publicId = urlSinVersion.substring(0, urlSinVersion.lastIndexOf('.'));
            await cloudinary.uploader.destroy(publicId);
        }
    } catch (error) { console.error("Error al borrar de la nube:", error); }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const session = await getSession(request);
        if (session?.user?.email !== 'fernando.jose.reynosa@gmail.com') {
            return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 401 });
        }

        const formData = await request.formData();
        const nombre = formData.get('nombre') as string;
        const descripcion = formData.get('descripcion') as string;
        const historia = formData.get('historia') as string;
        const archivoPortada = formData.get('imagenPortada') as File;

        if (!nombre || !descripcion || !archivoPortada) {
            return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400 });
        }

        // Subir Portada
        const imagenUrl = await subirACloudinary(archivoPortada, 'portadas');

        // Subir Galería (8 fotos)
        const galeriaUrls: string[] = [];
        for (let i = 0; i < 8; i++) {
            const file = formData.get(`galeria_${i}`) as File;
            const url = await subirACloudinary(file, 'galeria');
            if (url) galeriaUrls.push(url);
        }

        if (galeriaUrls.length !== 8) {
            return new Response(JSON.stringify({ error: 'Debes subir las 8 imágenes de la galería' }), { status: 400 });
        }

        const nuevaSala = await prisma.sala.create({
            data: { nombre, descripcion, imagenUrl: imagenUrl!, historia: historia || "", galeria: galeriaUrls }
        });

        return new Response(JSON.stringify(nuevaSala), { status: 201 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const session = await getSession(request);
        if (session?.user?.email !== 'fernando.jose.reynosa@gmail.com') return new Response(null, { status: 401 });

        const { id } = await request.json();
        const sala = await prisma.sala.findUnique({ where: { id } });
        if (!sala) return new Response(null, { status: 404 });

        // Borrar todo de Cloudinary antes de borrar de la DB
        await borrarDeCloudinary(sala.imagenUrl);
        for (const foto of sala.galeria) await borrarDeCloudinary(foto);

        await prisma.sala.delete({ where: { id } });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) { return new Response(null, { status: 500 }); }
};

export const GET: APIRoute = async () => {
    const salas = await prisma.sala.findMany({ orderBy: { createdAt: 'desc' } });
    return new Response(JSON.stringify(salas), { status: 200 });
};