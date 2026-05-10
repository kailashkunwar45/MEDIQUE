import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const poppins = Poppins({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-heading" 
});

export const metadata: Metadata = {
  title: "MediQueue | Smart Hospital System",
  description: "Professional hospital management and appointment booking platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, poppins.variable)}>
      <body
        className="antialiased min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
