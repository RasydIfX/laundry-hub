import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { reweighOrder } from "@/lib/order-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only Kasir or Admin can reweigh and adjust customer invoice
  const { user, errorResponse } = await requireAuth(req, ["kasir", "admin"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ success: false, error: "ID pesanan tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { items, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Daftar berat aktual item layanan harus diisi." },
        { status: 400 }
      );
    }

    const updated = await reweighOrder({
      orderId,
      items: items.map((i: { itemId: number; actualQuantity: number }) => ({
        itemId: Number(i.itemId),
        actualQuantity: Number(i.actualQuantity),
      })),
      changedByUserId: user!.id,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: "Penimbangan aktual berhasil dicatat. Total pesanan dan nota telah diperbarui otomatis.",
      data: updated,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Gagal menyimpan penimbangan aktual.";
    console.error("Reweigh Order Error:", error);
    return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
  }
}
