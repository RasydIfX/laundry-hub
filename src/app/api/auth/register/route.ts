import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, password } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { success: false, error: "Nama, nomor HP, dan password wajib diisi." },
        { status: 400 }
      );
    }

    // Check if phone already registered
    const existingPhone = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp/HP sudah terdaftar." },
        { status: 409 }
      );
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: "Email sudah terdaftar." },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        password_hash: passwordHash,
        role: "customer",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    const token = signToken({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi berhasil.",
        data: {
          user,
          token,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
