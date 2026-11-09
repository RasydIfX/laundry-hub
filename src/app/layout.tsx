import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaundryHub Bandar Lampung — Workshop Cuci Kiloan & Satuan Modern",
  description: "Layanan laundry kiloan dan satuan berstandar hotel di Bandar Lampung dengan antar-jemput terjadwal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#fbfbfa] text-[#141619]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
