import type { Metadata } from "next";
import { Manrope, Nunito, Press_Start_2P, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-manrope",
});
const nunito = Nunito({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-nunito",
});
const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});
// Elegant gallery typography.
const playfair = Playfair_Display({
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair",
});
const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Chai Stains",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${nunito.variable} ${pixel.variable} ${playfair.variable} ${cormorant.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
