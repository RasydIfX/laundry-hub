"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AuthProvider } from "@/components/AuthProvider";

const LaundryApp = dynamic(() => import("@/components/LaundryApp"), {
  ssr: false,
});

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="min-h-screen bg-[#fbfbfa] flex items-center justify-center font-mono text-xs text-[#64748b]"
        suppressHydrationWarning
      >
        Inisialisasi sistem LaundryHub Bandar Lampung...
      </div>
    );
  }

  return (
    <AuthProvider>
      <LaundryApp />
    </AuthProvider>
  );
}
