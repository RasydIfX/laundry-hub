import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatOrderMessage, sendNotification, formatPhoneNumberForWhatsApp } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin", "kasir", "kurir"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ success: false, error: "ID pesanan tidak valid." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { service: true } },
        payments: true,
        outlet: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const isPaid = order.payments.some((p) => p.status === "paid");
    const serviceNames = order.items.map((i) => i.service.name).join(", ");
    const trackingUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`;

    let event = "status_changed";
    if (order.status === "ready") event = "ready";
    else if (order.status === "completed") event = "completed";

    const message = formatOrderMessage(event, {
      customerName: order.customer.name,
      orderNo: order.order_no,
      statusLabel: order.status.toUpperCase(),
      fulfillmentType: order.fulfillment_type,
      total: order.total,
      isPaid,
      services: serviceNames,
      trackingUrl,
    });

    const waPhone = formatPhoneNumberForWhatsApp(order.customer.phone);
    const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        order_no: order.order_no,
        customer_name: order.customer.name,
        phone: waPhone,
        message,
        wa_link: waLink,
      },
    });
  } catch (error) {
    console.error("Get WhatsApp Link Error:", error);
    return NextResponse.json({ success: false, error: "Gagal membuat tautan WhatsApp." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req, ["admin", "kasir", "kurir"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ success: false, error: "ID pesanan tidak valid." }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const customMessage = body.message;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { service: true } },
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const isPaid = order.payments.some((p) => p.status === "paid");
    const serviceNames = order.items.map((i) => i.service.name).join(", ");
    const trackingUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?order=${order.order_no}`;

    let event = "status_changed";
    if (order.status === "ready") event = "ready";
    else if (order.status === "completed") event = "completed";

    const message =
      customMessage ||
      formatOrderMessage(event, {
        customerName: order.customer.name,
        orderNo: order.order_no,
        statusLabel: order.status.toUpperCase(),
        fulfillmentType: order.fulfillment_type,
        total: order.total,
        isPaid,
        services: serviceNames,
        trackingUrl,
      });

    const notifResult = await sendNotification({
      userId: order.customer_id,
      orderId: order.id,
      phone: order.customer.phone,
      channel: "whatsapp",
      message,
    });

    return NextResponse.json({
      success: true,
      message: "Notifikasi WhatsApp berhasil diproses.",
      data: notifResult,
    });
  } catch (error) {
    console.error("Send WhatsApp Notification Error:", error);
    return NextResponse.json({ success: false, error: "Gagal mengirim notifikasi WhatsApp." }, { status: 500 });
  }
}
