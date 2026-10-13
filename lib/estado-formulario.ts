// Lo que una Server Action devuelve al formulario que la invocó. Solo tipos:
// se puede importar desde componentes de cliente sin arrastrar código de servidor.
export type EstadoFormulario = { error: string | null; aviso?: string | null };
