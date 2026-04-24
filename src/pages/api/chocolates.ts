import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { getSession } from 'auth-astro/server';

// Configuración de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
        const precio = parseFloat(formData.get('precio') as string);
        const stock = parseInt(formData.get('stock') as string);
        const categoriaId = formData.get('categoriaId') as string;
        const archivoImagen = formData.get('imagen') as File;

        if (!nombre || !precio || !categoriaId || !archivoImagen) {
            return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400 });
        }

        const imagenUrl = await subirACloudinary(archivoImagen, 'chocolates');

        const nuevoChocolate = await prisma.chocolate.create({
            data: {
                nombre,
                descripcion,
                precio,
                stock,
                categoriaId,
                imagenUrl: imagenUrl!
            }
        });

        return new Response(JSON.stringify(nuevoChocolate), { status: 201 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const session = await getSession(request);
        if (session?.user?.email !== 'fernando.jose.reynosa@gmail.com') return new Response(null, { status: 401 });

        const { id } = await request.json();
        const chocolate = await prisma.chocolate.findUnique({ where: { id } });
        if (!chocolate) return new Response(null, { status: 404 });

        if (chocolate.imagenUrl) await borrarDeCloudinary(chocolate.imagenUrl);

        await prisma.chocolate.delete({ where: { id } });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) { return new Response(null, { status: 500 }); }
};