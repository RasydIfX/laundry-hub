import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ success: false, error: "ID pengguna tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, phone, email, role, is_active, password } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (email !== undefined) data.email = email ? email.trim().toLowerCase() : null;
    if (role !== undefined) data.role = role;
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (password) data.password_hash = await hashPassword(password);

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
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

    return NextResponse.json({
      success: true,
      message: "Data pengguna berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    return NextResponse.json({ success: false, error: "Gagal memperbarui data pengguna." }, { status: 500 });
  }
}
