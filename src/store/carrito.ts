import { persistentAtom } from '@nanostores/persistent';

// 1. Definimos cómo se ve un "Producto en el Carrito"
export type CartItem = {
    id: string;
    nombre: string;
    precio: number;
    cantidad: number;
    imagenUrl: string | null;
};

// 2. Creamos la base de datos local del navegador (localStorage)
// Guardará un diccionario donde la "llave" es el ID del producto, y el "valor" son sus datos
export const carrito = persistentAtom<Record<string, CartItem>>(
    'carrito_museo', // Este es el nombre del archivo secreto en el navegador
    {},
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    }
);

// 3. Función inteligente para agregar productos
export function agregarAlCarrito(producto: Omit<CartItem, 'cantidad'>) {
    const itemsActuales = carrito.get();
    const itemExistente = itemsActuales[producto.id];

    if (itemExistente) {
        // Si ya existe, solo sumamos 1 a la cantidad
        carrito.set({
            ...itemsActuales,
            [producto.id]: { ...itemExistente, cantidad: itemExistente.cantidad + 1 }
        });
    } else {
        // Si es nuevo, lo agregamos con cantidad 1
        carrito.set({
            ...itemsActuales,
            [producto.id]: { ...producto, cantidad: 1 }
        });
    }
}