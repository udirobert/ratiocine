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
    default: "ratiocine — linguistics puzzle game",
    template: "%s · ratiocine",
  },
  description:
    "A linguistics deduction game built from our IOL-AI 2026 entry. Crack the pattern of a real language, then watch the machine try — same puzzle, same grading.",
  applicationName: "ratiocine",
  authors: [{ name: "udirobert", url: "https://github.com/udirobert/ratiocine" }],
  creator: "udirobert",
  keywords: [
    "IOL-AI 2026",
    "linguistics olympiad",
    "linguistics puzzle",
    "language game",
    "AI comparison",
    "Qwen2.5",
    "endangered languages",
  ],
  openGraph: {
    type: "website",
    siteName: "ratiocine",
    title: "ratiocine — crack the pattern, then watch the machine try",
    description:
      "A daily linguistics deduction puzzle. You and a 14B-parameter model, graded by the same algorithm. Built from our IOL-AI 2026 competition entry.",
    url: "https://ratiocine.vercel.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ratiocine — linguistics puzzle game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ratiocine — crack the pattern, then watch the machine try",
    description:
      "A daily linguistics deduction puzzle. You and a 14B-parameter model, graded by the same algorithm. Built from our IOL-AI 2026 competition entry.",
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
