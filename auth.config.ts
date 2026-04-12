import { defineConfig } from 'auth-astro';
import Google from '@auth/core/providers/google';

export default defineConfig({
    providers: [
        Google({
            clientId: import.meta.env.GOOGLE_CLIENT_ID,
            clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        // Esta función se ejecuta justo cuando Google dice "Sí, el usuario existe"
        signIn: async ({ profile }) => {
            // 1. Traemos la lista de correos permitidos desde el .env
            const adminEmails = import.meta.env.ADMIN_EMAILS?.split(',') || [];

            // 2. Verificamos si el correo de quien intenta entrar está en la lista
            if (profile?.email && adminEmails.includes(profile.email)) {
                console.log(`✅ Acceso concedido a: ${profile.email}`);
                return true; // ¡Adelante, pase!
            }

            // 3. Si no está en la lista, le cerramos la puerta en la cara
            console.warn(`🚨 Intento de acceso DENEGADO para: ${profile?.email}`);
            return false; // Auth.js bloqueará el inicio de sesión
        }
    }
});