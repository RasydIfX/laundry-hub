import { prisma } from "./prisma";

export interface SendNotificationParams {
  userId: number;
  orderId: number;
  phone?: string;
  channel?: "whatsapp" | "email";
  message: string;
}

export interface NotificationResult {
  id: number;
  status: string;
  channel: string;
  phone?: string;
  wa_link?: string;
  message: string;
  sent_at?: Date | null;
}

/**
 * Normalizes Indonesian phone number to international WhatsApp format (628xxx)
 */
export function formatPhoneNumberForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

/**
 * Format standard WhatsApp notification message based on order event
 */
export function formatOrderMessage(event: string, data: Record<string, string | number | boolean>): string {
  switch (event) {
    case "order_created":
      return `Halo Kak ${data.customerName}! 🧺
Pesanan LaundryHub Anda berhasil terdaftar.

📋 *Detail Pesanan:*
• No. Nota: *${data.orderNo}*
• Layanan: ${data.services || "Paket Laundry"}
• Estimasi Total: Rp ${Number(data.total || 0).toLocaleString("id-ID")}
• Metode: ${data.fulfillmentType === "pickup_delivery" ? "Antar-Jemput (Pickup & Delivery) 🛵" : "Antar Sendiri ke Outlet (Drop-off) 🏪"}

Pantau status pengerjaan pakaian Anda secara real-time:
${data.trackingUrl}

Terima kasih telah mempercayakan pakaian Anda pada LaundryHub Bandar Lampung! 🙏`;

    case "reweighed":
      return `Halo Kak ${data.customerName}! ⚖️
Pakaian Anda telah tiba di Workshop LaundryHub dan dilakukan penimbangan aktual:

📋 *Hasil Timbang Ulang:*
• No. Nota: *${data.orderNo}*
• Berat Riil: *${data.actualWeight} kg*
• Total Biaya Akhir: *Rp ${Number(data.newTotal || 0).toLocaleString("id-ID")}*

Pakaian Anda langsung diproses ke tahap pencucian higienis. Terima kasih! ✨`;

    case "ready":
      return `Halo Kak ${data.customerName}! ✨🧺
Kabar gembira dari LaundryHub! Pakaian Anda dengan No. Nota *${data.orderNo}* sudah *SELESAI DIPROSES* (sudah bersih, higienis, disetrika rapi, dan harum).

📋 *Informasi Pengambilan / Pengantaran:*
• Total Tagihan: *Rp ${Number(data.total || 0).toLocaleString("id-ID")}* (${data.isPaid ? "LUNAS ✅" : "BELUM LUNAS ⚠️"})
• Status: ${
        data.fulfillmentType === "pickup_delivery"
          ? "Sedang dijadwalkan untuk diantar Kurir ke alamat Anda 🛵"
          : "Pakaian sudah siap diambil di Outlet Kedaton 🏪"
      }

Pantau live manifest pesanan Anda:
${data.trackingUrl}

Terima kasih telah mencuci di LaundryHub! 🙏`;

    case "completed":
      return `Halo Kak ${data.customerName}! ✅
Terima kasih banyak! Pesanan cucian Anda (*${data.orderNo}*) telah selesai diserahterimakan.

Mohon luangkan waktu 1 menit untuk memberikan rating & ulasan kepuasan Anda melalui link berikut:
${data.trackingUrl}

Sampai jumpa pada pesanan laundry Anda berikutnya! 🧺✨`;

    case "status_changed":
    default:
      return `Halo Kak ${data.customerName}! 🚀
Status pesanan LaundryHub Anda (*${data.orderNo}*) telah diperbarui:
• Status Terkini: *${data.statusLabel}*
• Catatan: ${data.note || "Sedang diproses oleh tim profesional LaundryHub"}

Cek progress selengkapnya di:
${data.trackingUrl}`;
  }
}

/**
 * Sends notification (WhatsApp or Email) and records it to database audit trail.
 * Supports direct Fonnte API dispatch and generates WhatsApp click-to-chat links.
 */
export async function sendNotification({
  userId,
  orderId,
  phone,
  channel = "whatsapp",
  message,
}: SendNotificationParams): Promise<NotificationResult | null> {
  try {
    // 1. Resolve customer phone if not provided
    let rawPhone = phone;
    if (!rawPhone && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      rawPhone = user?.phone;
    }

    const waPhone = rawPhone ? formatPhoneNumberForWhatsApp(rawPhone) : undefined;
    const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : undefined;

    // 2. Record in DB as queued
    const notif = await prisma.notification.create({
      data: {
        user_id: userId,
        order_id: orderId,
        channel,
        message,
        status: "queued",
      },
    });

    let isSuccess = true;

    // 3. Dispatch to WhatsApp Gateway (Fonnte API) if token is configured in .env
    const fonnteToken = process.env.FONNTE_TOKEN || process.env.WHATSAPP_API_TOKEN;
    if (channel === "whatsapp" && waPhone && fonnteToken) {
      try {
        const fonnteRes = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            Authorization: fonnteToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: waPhone,
            message: message,
          }),
        });
        const fonnteData = await fonnteRes.json();
        console.log(`[FONNTE WA API] Response:`, fonnteData);
        isSuccess = fonnteData.status === true || fonnteData.status === "true";
      } catch (fErr) {
        console.error("[FONNTE WA API ERROR]", fErr);
        isSuccess = false;
      }
    } else {
      // Mock / Local simulated gateway dispatch
      console.log(`[WHATSAPP GATEWAY DISPATCH] Target: +${waPhone || "N/A"} | Order: #${orderId}`);
      console.log(`[WHATSAPP MESSAGE CONTENT]:\n${message}`);
      console.log(`[WHATSAPP DIRECT LINK]: ${waLink}`);
    }

    // 4. Mark as sent in DB
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: {
        status: isSuccess ? "sent" : "failed",
        sent_at: isSuccess ? new Date() : null,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      channel: updated.channel,
      phone: waPhone,
      wa_link: waLink,
      message,
      sent_at: updated.sent_at,
    };
  } catch (error) {
    console.error("[NOTIFICATION ERROR]", error);
    return null;
  }
}
