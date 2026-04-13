import { persistentAtom } from '@nanostores/persistent';

export const tema = persistentAtom('tema', 'dark'); // Por defecto, modo museo (oscuro)

export function toggleTema() {
    tema.set(tema.get() === 'dark' ? 'light' : 'dark');
}