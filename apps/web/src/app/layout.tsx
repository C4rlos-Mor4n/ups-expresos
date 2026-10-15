import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  variable: "--font-inter",
  src: [
    { path: "../fonts/Inter_400Regular.ttf", weight: "400" },
    { path: "../fonts/Inter_500Medium.ttf", weight: "500" },
    { path: "../fonts/Inter_600SemiBold.ttf", weight: "600" },
    { path: "../fonts/Inter_700Bold.ttf", weight: "700" },
    { path: "../fonts/Inter_800ExtraBold.ttf", weight: "800" },
  ],
});

export const metadata: Metadata = {
  title: { default: "UPS GO · Panel", template: "%s · UPS GO Panel" },
  description: "Panel administrativo del transporte universitario UPS GO",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
