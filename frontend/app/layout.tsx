import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { AppContextProvider } from "./context/AppContext";
import AppShell from "./components/AppShell";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Note Bot",
  description: "Your thoughts, beautifully organized",
  openGraph: {
    title: "Note Bot",
    description: "Your thoughts, beautifully organized",
    url: "https://thenotebot.vercel.app",
    siteName: "Note Bot",
    images: [
      {
        url: "https://thenotebot.vercel.app/og-image.svg",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  themeColor: "#111827",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Note Bot",
  },
};

export const icon = {
  url: '/icon-512.png',
  sizes: '512x512',
  type: 'image/png',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ServiceWorkerRegister />
        <ThemeProvider><AppContextProvider><AppShell>{children}</AppShell></AppContextProvider></ThemeProvider>
      </body>
    </html>
  );
}
