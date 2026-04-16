// app/layout.tsx
// Root layout for MunchMates application.

import type { Metadata } from "next";
import { notoSans } from "../lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "MunchMates",
  description: "Find recipes with the ingredients you have at home!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} antialiased`}>
        <main className="main-layout">{children}</main>
      </body>
    </html>
  );
}
