import Google from "@auth/core/providers/google";
import { defineConfig } from "auth-astro";

export default defineConfig({
    providers: [
        Google({
            clientId: import.meta.env.GOOGLE_CLIENT_ID,
            clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
            issuer: "https://accounts.google.com",
        }),
    ],

    // Importante para que Azure no bloquee la sesión
    trustHost: true,

    callbacks: {
        signIn: async ({ profile }) => {
            // Convertimos el string de correos en un arreglo y quitamos espacios
            const adminEmails = import.meta.env.ADMIN_EMAILS?.split(",").map((e: string) => e.trim()) || [];

            if (profile?.email && adminEmails.includes(profile.email)) {
                console.log(`✅ Bienvenid@ al Museo: ${profile.email}`);
                return true;
            }

            console.warn(`🚨 Acceso denegado: ${profile?.email}`);
            return false;
        },

        session: async ({ session, token }) => {
            if (session.user) {
                // Aquí podrías guardar el ID de usuario si lo necesitas para Prisma después
                // session.user.id = token.sub;
            }
            return session;
        },
    },

    pages: {
        signIn: '/cuenta/login',
        error: '/cuenta/login',
    }
});