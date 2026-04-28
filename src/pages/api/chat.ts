import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const POST: APIRoute = async ({ request }) => {
    try {
        // 🛡️ BLINDAJE DOBLE: Intenta leer de Astro (local) o de Node/Vercel (producción)
        const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            console.error("❌ ERROR CRÍTICO: No se encontró la llave de OpenAI");
            throw new Error("No se encontró la llave de OpenAI");
        }

        const openai = new OpenAI({ apiKey });

        const body = await request.json();
        const { mensaje } = body;

        if (!mensaje) {
            return new Response(JSON.stringify({ error: "Falta el mensaje" }), { status: 400 });
        }

        // Llamada a la API de ChatGPT
        const completacion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Eres el 'Curador Virtual', un asistente experto en cacao y chocolate para el sitio web del Museo de Chocolate. 
                    Tu tono debe ser elegante, amable, educado y apasionado por la historia del cacao en México. 
                    Responde preguntas sobre el chocolate, horarios, precios e historia. 
                    Mantén tus respuestas breves (máximo 3 párrafos cortos) y fáciles de leer en un chat de celular.`
                },
                { role: "user", content: mensaje }
            ],
            temperature: 0.7,
        });

        const respuestaIA = completacion.choices[0].message.content;

        return new Response(JSON.stringify({ respuesta: respuestaIA }), { status: 200 });

    } catch (error: any) {
        console.error("Error en OpenAI:", error);
        return new Response(JSON.stringify({ error: "El curador está descansando." }), { status: 500 });
    }
};