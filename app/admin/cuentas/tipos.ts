// Resultado que devuelve la acción de /admin/cuentas a la fila que la invocó.
// aviso: texto informativo cuando el cambio se hizo pero algo secundario no
// (por ejemplo, el correo al usuario).
export type EstadoCuenta = { error: string | null; exito: boolean; aviso?: string | null };
