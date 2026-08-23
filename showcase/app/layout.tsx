import "./globals.css";

import clsx from "clsx";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ratiocine.vercel.app"),
  title: {
    default: "ratiocine — IOL-AI 2026",
    template: "%s · ratiocine",
  },
  description:
    "How I built an AI to compete in the International Linguistics Olympiad using Arkor, Modal, Vultr, Cohere Labs and Hugging Face.",
  applicationName: "ratiocine",
  authors: [{ name: "udirobert", url: "https://github.com/udirobert/ratiocine" }],
  creator: "udirobert",
  keywords: [
    "IOL-AI 2026",
    "linguistics olympiad",
    "natural language processing",
    "AI",
    "Qwen2.5",
    "chain-key signing",
  ],
  openGraph: {
    type: "website",
    siteName: "ratiocine",
    title: "ratiocine — IOL-AI 2026",
    description:
      "An AI that solves International Linguistics Olympiad problems — the problem · the machine · the answer.",
    url: "https://ratiocine.vercel.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ratiocine — IOL-AI 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ratiocine — IOL-AI 2026",
    description:
      "An AI that solves International Linguistics Olympiad problems — the problem · the machine · the answer.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en" className={cn(clsx(geistSans.variable))}>
    <head>
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/favicon.png" sizes="32x32" type="image/png" />
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
