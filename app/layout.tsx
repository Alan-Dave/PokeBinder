import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import BarraNavegacion from "@/components/BarraNavegacion";
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

export const metadata: Metadata = {
  title: "PokeBinder",
  description: "Gestión de colecciones físicas de Pokémon TCG",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${baloo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BarraNavegacion />
        {children}
      </body>
    </html>
  );
}
