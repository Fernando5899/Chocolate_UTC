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
            // Obtenemos la lista de los dos lugares posibles para no fallar en Azure
            const envEmails = import.meta.env.ADMIN_EMAILS || process.env.ADMIN_EMAILS;
            const adminEmails = envEmails?.split(",").map((e: string) => e.trim()) || [];

            if (profile?.email && adminEmails.includes(profile.email)) {
                console.log(`✅ Acceso concedido: ${profile.email}`);
                return true;
            }

            // Esto saldrá en tus logs de Azure (az webapp log tail)
            console.warn(`🚨 Bloqueado por lista blanca: ${profile?.email}`);
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