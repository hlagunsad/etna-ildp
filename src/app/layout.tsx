import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eTNA → ILDP",
  description:
    "Competency development platform: annual Training Needs Analysis → gap analysis → Individual Learning & Development Plan, tracked over a 3-year cycle.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
