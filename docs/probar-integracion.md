# Probar la aplicación completa (rama de integración)

Esta rama (`integracion/prueba-completa`) junta `develop` con todos los PR abiertos
para poder probar la aplicación entera antes de fusionarlos. **No se fusiona a
`develop` ni a `main`**: es solo para probar. Los cambios reales se revisan y
fusionan en cada PR.

PR incluidos: #38, #40, #41, #42, #43, #44, #45, #46, #47, #48 y #49.

## Arrancar

```bash
git fetch
git checkout integracion/prueba-completa
npm install
```

Crea `.env.local` (git lo ignora) a partir de `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: del panel de
  Supabase (Project Settings → API).
- `SUPABASE_SECRET_KEY`: sin ella no se ven las imágenes del catálogo ni se guarda
  el historial de precios. **Nunca** va en un archivo versionado ni en un chat.

```bash
npm run dev
```

y abre http://localhost:3000.

## Cuidado

El proyecto de Supabase es el real: registrarse, agregar cartas o enviar un
reporte crea datos reales. Prueba con tu propio usuario y bórralo después.
Las migraciones de PBI-30 y PBI-31 ya están aplicadas.

## Qué recorrer

- Catálogo y ficha de carta: precio de mercado (PBI-29) y «Reportar un error» (PBI-31).
- Mi colección: precios, valor estimado, evolución del valor (PBI-30) y exportar CSV/Excel (PBI-22).
- Binder con arrastrar y soltar (PBI-15).
- Mazos: reglas, legalidad por formato (PBI-19) y proxies PDF (PBI-20).
- `/reportes` (PBI-21/24) y `/dashboard` (PBI-23).
- Superusuario: `/admin/usuarios` (PBI-25), `/admin/auditoria` y `/admin/reportes` (PBI-31).

## Conflictos conocidos al fusionar

Varios PR modifican las mismas líneas de `vitest.config.mts`, `lib/tcgdex.ts`,
`app/page.tsx` y `app/coleccion/page.tsx`. En esta rama ya están resueltos; al
fusionar los PR uno por uno hay que resolverlos de la misma manera.
