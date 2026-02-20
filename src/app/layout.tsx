import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PWARegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invoice Manager",
  description: "Simple invoicing & accounting for your business",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Invoice Manager",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
