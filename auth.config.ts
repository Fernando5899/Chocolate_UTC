import Google from "@auth/core/providers/google";
import { defineConfig } from "auth-astro";

export default defineConfig({
    providers: [
        Google({
            clientId: import.meta.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
            clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
            issuer: "https://accounts.google.com",
        }),
    ],

    trustHost: true,

    callbacks: {
        // Dejamos pasar a todos para que puedan ser clientes del museo
        signIn: async ({ profile }) => {
            return true;
        },
        session: async ({ session }) => {
            return session;
        },
    },

    pages: {
        signIn: '/cuenta/login',
        error: '/cuenta/login',
    }
});