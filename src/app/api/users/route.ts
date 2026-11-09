import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const search = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Fetch Users Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil daftar pengguna." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name, phone, email, password, role } = body;

    if (!name || !phone || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Nama, nomor HP, password, dan peran wajib diisi." },
        { status: 400 }
      );
    }

    const validRoles = ["customer", "admin", "kasir", "kurir"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Peran tidak valid. Pilihan: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone: phone.trim() }, ...(email ? [{ email: email.trim().toLowerCase() }] : [])] },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Nomor HP atau email sudah terdaftar." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        password_hash: passwordHash,
        role,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    return NextResponse.json(
      { success: true, message: `Pengguna ${role} berhasil ditambahkan.`, data: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create User Error:", error);
    return NextResponse.json({ success: false, error: "Gagal menambahkan pengguna." }, { status: 500 });
  }
}
