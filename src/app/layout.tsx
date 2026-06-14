import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });
const sans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--font-public" });

export const metadata: Metadata = {
  title: "eTNA → ILDP",
  description:
    "Competency development platform: annual Training Needs Analysis → gap analysis → Individual Learning & Development Plan, tracked over a 3-year cycle.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
