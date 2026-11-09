import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req, ["admin", "kasir", "kurir"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};

    // Kurir only sees their own assigned tasks
    if (user!.role === "kurir") {
      where.courier_id = user!.id;
    }

    if (status) where.status = status;
    if (type) where.type = type;

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            outlet: true,
            items: { include: { service: true } },
          },
        },
        address: true,
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { scheduled_at: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: deliveries,
    });
  } catch (error) {
    console.error("Fetch Deliveries Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengambil daftar tugas kurir." }, { status: 500 });
  }
}
