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
  title: "ratiocine — IOL-AI 2026",
  description:
    "How I built an AI to compete in the International Linguistics Olympiad using Arkor, Modal, Vultr, Cohere Labs and Hugging Face.",
};

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  <html lang="en" className={cn(clsx(geistSans.variable))}>
    <body>{children}</body>
  </html>
);

export default RootLayout;
