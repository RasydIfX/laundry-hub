import { prisma } from "./prisma";

export interface SendNotificationParams {
  userId: number;
  orderId: number;
  channel?: "whatsapp" | "email";
  message: string;
}

/**
 * Format standard WhatsApp notification message based on order event
 */
export function formatOrderMessage(event: string, data: Record<string, string | number>): string {
  switch (event) {
    case "order_created":
      return `Halo Kak ${data.customerName}! 🧺
Pesanan LaundryHub Anda berhasil terdaftar.
No. Nota: ${data.orderNo}
Layanan: ${data.services}
Estimasi Total: Rp ${Number(data.total).toLocaleString("id-ID")}
Jadwal: ${data.fulfillment}

Pantau status pengerjaan cucian Anda secara live melalui:
${data.trackingUrl}

Terima kasih telah mempercayakan pakaian Anda pada LaundryHub Bandar Lampung!`;

    case "reweighed":
      return `Halo Kak ${data.customerName}! ⚖️
Pakaian Anda telah tiba di Workshop LaundryHub dan dilakukan penimbangan aktual:
No. Nota: ${data.orderNo}
Berat Aktual: ${data.actualWeight} kg
Total Biaya Akhir: Rp ${Number(data.newTotal).toLocaleString("id-ID")}

Pakaian Anda sedang masuk ke antrean pencucian higienis berstandar hotel. Terima kasih!`;

    case "status_changed":
      return `Halo Kak ${data.customerName}! 🚀
Status pesanan LaundryHub Anda telah diperbarui:
No. Nota: ${data.orderNo}
Status Terkini: ${data.statusLabel}
Catatan: ${data.note || "Sedang diproses oleh staf profesional LaundryHub"}

Cek progress selengkapnya di:
${data.trackingUrl}`;

    case "ready":
      return `Halo Kak ${data.customerName}! ✨
Kabar gembira! Cucian Anda (${data.orderNo}) sudah SELESAI, bersih, wangi, dan rapi.
${
  data.fulfillmentType === "pickup_delivery"
    ? "Kurir LaundryHub segera mengantarkannya ke alamat Anda."
    : "Pakaian sudah siap diambil di outlet workshop kami."
}

Terima kasih atas kepercayaan Anda!`;

    default:
      return `Update Pesanan LaundryHub (${data.orderNo}): ${data.message || "Status diperbarui"}`;
  }
}

/**
 * Sends notification (WhatsApp or Email) and records it to database audit trail
 */
export async function sendNotification({
  userId,
  orderId,
  channel = "whatsapp",
  message,
}: SendNotificationParams) {
  try {
    // 1. Record in DB as queued
    const notif = await prisma.notification.create({
      data: {
        user_id: userId,
        order_id: orderId,
        channel,
        message,
        status: "queued",
      },
    });

    // 2. Simulate dispatch to third party provider (e.g., Fonnte WhatsApp API or Resend Email)
    // In production: await fetch('https://api.fonnte.com/send', { ... })
    const isSuccess = true;

    // 3. Mark as sent with timestamp
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: {
        status: isSuccess ? "sent" : "failed",
        sent_at: isSuccess ? new Date() : null,
      },
    });

    console.log(`[NOTIFICATION DISPATCHED] Channel: ${channel} | Order: #${orderId} | Status: ${updated.status}`);
    return updated;
  } catch (error) {
    console.error("[NOTIFICATION ERROR]", error);
    return null;
  }
}
