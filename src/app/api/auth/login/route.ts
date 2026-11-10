import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { runDatabaseSeed } from "@/lib/seed-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body; // identifier can be phone, email, or alias

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "ID/Nomor HP dan password wajib diisi." },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim();
    const lower = cleanIdentifier.toLowerCase();

    // Auto-seed if database is fresh / completely empty
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.log("Database kosong terdeteksi, menjalankan auto-seed data default...");
        await runDatabaseSeed();
      }
    } catch (seedErr) {
      console.warn("Auto-seed check skipped:", seedErr);
    }

    // Find by phone, email, or ID alias (admin, kasir, kurir, etc.)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanIdentifier },
          { email: lower },
          { email: `${lower}@laundryhub.com` },
          { email: { startsWith: `${lower}@` } },
          ...(lower === "admin" ? [{ role: "admin" }] : []),
          ...(lower === "kasir" ? [{ role: "kasir" }] : []),
          ...(lower === "kurir" ? [{ role: "kurir" }] : []),
        ],
      },
      orderBy: { id: "asc" },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "ID / Nomor HP atau password salah." },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: "Akun Anda dinonaktifkan. Silakan hubungi admin." },
        { status: 403 }
      );
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "ID / Nomor HP atau password salah." },
        { status: 401 }
      );
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    const userProfile = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };

    const res = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      data: {
        user: userProfile,
        token,
      },
    });

    // Also set HTTP cookie for browser session convenience
    res.cookies.set("token", token, {
      httpOnly: false, // Accessible to client state
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
