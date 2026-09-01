import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description: "A curated directory of UI libraries with shadcn CLI support.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    description: "A curated directory of UI libraries with shadcn CLI support.",
    images: [{ height: 900, url: "/og.png", width: 1600 }],
    title: "Awesome shadcn/ui",
    type: "website",
  },
  title: {
    default: "Awesome shadcn/ui",
    template: "%s — Awesome shadcn/ui",
  },
  twitter: {
    card: "summary_large_image",
    description: "A curated directory of UI libraries with shadcn CLI support.",
    images: ["/og.png"],
    title: "Awesome shadcn/ui",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
      lang="en"
    >
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
