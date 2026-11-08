import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import BarraNavegacion from "@/components/BarraNavegacion";
import SonidoInteraccion from "@/components/SonidoInteraccion";
import "./globals.css";

// Las fuentes se descargan al compilar y se sirven desde el propio dominio:
// la página no pide nada a Google al cargar (compatible con la CSP del PBI-27).
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Las imágenes para compartir (Open Graph) necesitan una URL absoluta. Vercel
// informa el dominio de producción; en local se usa localhost.
const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "PokeBinder",
  description: "Gestión de colecciones físicas de Pokémon TCG",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${baloo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BarraNavegacion />
        <SonidoInteraccion />
        {children}
      </body>
    </html>
  );
}
