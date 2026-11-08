import { claveDeCliente, crearLimitador } from "@/lib/limite-peticiones";
import { listarPanelColeccion, SIN_SESION } from "@/lib/panel-coleccion";
import { panelColeccionSchema, parametrosDePanel } from "@/lib/validators/panel-coleccion";

// El panel pide una página al cambiar la búsqueda (con espera de 300 ms en el
// navegador) y al pulsar «Cargar más»: este tope deja usarlo con holgura y corta
// a quien lo automatice.
const limitador = crearLimitador({ maximo: 120, ventanaMs: 60_000 });

// Las URLs de las imágenes están firmadas y caducan, y la respuesta es personal:
// nunca se guarda en cachés compartidas ni del navegador.
const CABECERAS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

/**
 * GET /api/coleccion/panel?texto=&categoria=&pagina= (PBI-X9)
 *
 * Cartas de la colección del usuario para el panel lateral del binder. Exige
 * sesión; sin ella responde 401 sin datos. Los parámetros se validan con zod
 * antes de tocar la base y el aislamiento entre usuarios lo hace RLS.
 */
export async function GET(peticion: Request) {
  const cliente = claveDeCliente(peticion.headers);
  if (!limitador.permitir(cliente)) {
    return new Response(null, {
      status: 429,
      headers: { ...CABECERAS, "retry-after": String(limitador.segundosParaReintentar(cliente)) },
    });
  }

  const entrada = parametrosDePanel(new URL(peticion.url).searchParams);
  if (!panelColeccionSchema.safeParse(entrada).success) {
    return Response.json({ error: "La búsqueda no es válida." }, { status: 400, headers: CABECERAS });
  }

  const resultado = await listarPanelColeccion(entrada);
  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : 500;
    return Response.json({ error: resultado.error }, { status: estado, headers: CABECERAS });
  }
  return Response.json(resultado.datos, { headers: CABECERAS });
}
