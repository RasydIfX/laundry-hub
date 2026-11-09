import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding database Laundry Business Web App...");

  // 1. Bersihkan data lama jika ada
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderStatusLog.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promo.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.address.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 2. Seed Users (Role: admin, kasir, kurir, customer)
  console.log("👤 Membuat akun pengguna dengan berbagai peran (RBAC)...");
  const admin = await prisma.user.create({
    data: {
      name: "Super Admin Laundry",
      phone: "081234567890",
      email: "admin@laundryhub.com",
      password_hash: passwordHash,
      role: "admin",
      is_active: true,
    },
  });

  const kasir = await prisma.user.create({
    data: {
      name: "Siti Rahma (Kasir Kedaton)",
      phone: "081234567891",
      email: "kasir@laundryhub.com",
      password_hash: passwordHash,
      role: "kasir",
      is_active: true,
    },
  });

  const kurir = await prisma.user.create({
    data: {
      name: "Budi Pratama (Kurir Lampung BE 4129 YD)",
      phone: "081234567892",
      email: "kurir@laundryhub.com",
      password_hash: passwordHash,
      role: "kurir",
      is_active: true,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: "Ahmad Fauzi (Rajabasa)",
      phone: "081234567893",
      email: "ahmad.fauzi@gmail.com",
      password_hash: passwordHash,
      role: "customer",
      is_active: true,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: "Dewi Anggraini (Way Halim)",
      phone: "081234567894",
      email: "dewi.anggraini@gmail.com",
      password_hash: passwordHash,
      role: "customer",
      is_active: true,
    },
  });

  // 3. Seed Addresses
  console.log("📍 Membuat data alamat pelanggan di Bandar Lampung...");
  const address1 = await prisma.address.create({
    data: {
      user_id: customer1.id,
      label: "Rumah / Kos Rajabasa",
      full_address: "Jl. ZA Pagar Alam No. 45, RT 03 / RW 02, Gedong Meneng, Rajabasa, Bandar Lampung 35145",
      latitude: -5.3703,
      longitude: 105.2415,
      is_default: true,
    },
  });

  await prisma.address.create({
    data: {
      user_id: customer1.id,
      label: "Kantor Tanjung Karang",
      full_address: "Jl. Raden Intan No. 78, Enggal, Tanjung Karang Pusat, Bandar Lampung",
      latitude: -5.4124,
      longitude: 105.2589,
      is_default: false,
    },
  });

  const address2 = await prisma.address.create({
    data: {
      user_id: customer2.id,
      label: "Rumah Way Halim",
      full_address: "Perumahan Way Halim Permai Blok B No. 12, Way Halim, Bandar Lampung 35136",
      latitude: -5.3902,
      longitude: 105.2751,
      is_default: true,
    },
  });

  // 4. Seed Outlets
  console.log("🏢 Membuat data outlet di Bandar Lampung...");
  const outlet1 = await prisma.outlet.create({
    data: {
      name: "LaundryHub Pusat Kedaton",
      address: "Jl. Teuku Umar No. 88, Kedaton, Bandar Lampung (Dekat Mall Boemi Kedaton)",
      phone: "081277889901",
      open_hours: "07:00 - 21:00 WIB",
      is_active: true,
    },
  });

  const outlet2 = await prisma.outlet.create({
    data: {
      name: "LaundryHub Cabang Way Halim",
      address: "Jl. Sultan Agung No. 24, Way Halim Permai, Bandar Lampung",
      phone: "081277889902",
      open_hours: "08:00 - 20:00 WIB",
      is_active: true,
    },
  });

  // 5. Seed Service Categories
  console.log("🧺 Membuat kategori layanan...");
  const catKiloan = await prisma.serviceCategory.create({
    data: {
      name: "Kiloan",
      description: "Pakaian sehari-hari ditimbang per kilogram. Lebih hemat & bersih maksimal.",
      icon: "Scale",
    },
  });

  const catSatuan = await prisma.serviceCategory.create({
    data: {
      name: "Satuan",
      description: "Perawatan khusus item per item seperti kemeja, gaun, jas, bed cover, sepatu.",
      icon: "Shirt",
    },
  });

  const catExpress = await prisma.serviceCategory.create({
    data: {
      name: "Express",
      description: "Layanan kilat selesai dalam 6 jam atau 24 jam untuk kebutuhan mendesak.",
      icon: "Zap",
    },
  });

  const catDryClean = await prisma.serviceCategory.create({
    data: {
      name: "Dry Clean",
      description: "Pembersihan kimiawi ramah serat untuk jas, sutra, kebaya, dan pakaian pesta.",
      icon: "Sparkles",
    },
  });

  // 6. Seed Services
  console.log("🧼 Membuat daftar layanan dan harga...");
  const sKiloanKomplit = await prisma.service.create({
    data: {
      category_id: catKiloan.id,
      name: "Cuci + Setrika Reguler (2 Hari)",
      unit: "kg",
      price: 8000,
      est_duration_hours: 48,
      is_active: true,
    },
  });

  const sKiloanLipat = await prisma.service.create({
    data: {
      category_id: catKiloan.id,
      name: "Cuci Kering Lipat Reguler (2 Hari)",
      unit: "kg",
      price: 6000,
      est_duration_hours: 48,
      is_active: true,
    },
  });

  const sSetrika = await prisma.service.create({
    data: {
      category_id: catKiloan.id,
      name: "Setrika Saja (2 Hari)",
      unit: "kg",
      price: 5000,
      est_duration_hours: 48,
      is_active: true,
    },
  });

  const sExpress6H = await prisma.service.create({
    data: {
      category_id: catExpress.id,
      name: "Cuci + Setrika Express Kilat (6 Jam)",
      unit: "kg",
      price: 16000,
      est_duration_hours: 6,
      is_active: true,
    },
  });

  const sExpress24H = await prisma.service.create({
    data: {
      category_id: catExpress.id,
      name: "Cuci + Setrika Express 1 Hari (24 Jam)",
      unit: "kg",
      price: 12000,
      est_duration_hours: 24,
      is_active: true,
    },
  });

  const sKemeja = await prisma.service.create({
    data: {
      category_id: catSatuan.id,
      name: "Kemeja / Blus Formal",
      unit: "pcs",
      price: 15000,
      est_duration_hours: 48,
      is_active: true,
    },
  });

  const sJas = await prisma.service.create({
    data: {
      category_id: catSatuan.id,
      name: "Jas / Blazer Satuan",
      unit: "pcs",
      price: 35000,
      est_duration_hours: 72,
      is_active: true,
    },
  });

  const sBedCover = await prisma.service.create({
    data: {
      category_id: catSatuan.id,
      name: "Bed Cover Sedang / King",
      unit: "pcs",
      price: 30000,
      est_duration_hours: 48,
      is_active: true,
    },
  });

  const sSepatu = await prisma.service.create({
    data: {
      category_id: catSatuan.id,
      name: "Sepatu Sneakers / Canvas Deep Clean",
      unit: "pcs",
      price: 35000,
      est_duration_hours: 72,
      is_active: true,
    },
  });

  const sDryCleanJas = await prisma.service.create({
    data: {
      category_id: catDryClean.id,
      name: "Dry Clean Jas Lengkap (Setelan)",
      unit: "pcs",
      price: 65000,
      est_duration_hours: 72,
      is_active: true,
    },
  });

  // 7. Seed Promos
  console.log("🏷️ Membuat kode promo dan diskon...");
  const promo1 = await prisma.promo.create({
    data: {
      code: "BERSIHHEMAT",
      discount_type: "percent",
      discount_value: 15, // 15%
      min_order: 30000,
      start_date: new Date("2026-01-01"),
      end_date: new Date("2026-12-31"),
      quota: 300,
      used_count: 12,
      is_active: true,
    },
  });

  await prisma.promo.create({
    data: {
      code: "DISKON10K",
      discount_type: "fixed",
      discount_value: 10000,
      min_order: 50000,
      start_date: new Date("2026-01-01"),
      end_date: new Date("2026-12-31"),
      quota: 150,
      used_count: 5,
      is_active: true,
    },
  });

  await prisma.promo.create({
    data: {
      code: "PELANGGANBARU",
      discount_type: "percent",
      discount_value: 20, // 20%
      min_order: 25000,
      start_date: new Date("2026-01-01"),
      end_date: new Date("2026-12-31"),
      quota: 500,
      used_count: 24,
      is_active: true,
    },
  });

  // 8. Seed Sample Order 1: Pesanan Selesai (Completed dengan Delivery, Payment, Log, Review)
  console.log("📦 Membuat pesanan contoh 1 (Selesai dengan ulasan)...");
  const order1 = await prisma.order.create({
    data: {
      order_no: "LDR-20261108-001",
      customer_id: customer1.id,
      outlet_id: outlet1.id,
      promo_id: promo1.id,
      order_source: "online",
      fulfillment_type: "pickup_delivery",
      status: "completed",
      subtotal: 62000, // 4kg x 8000 = 32000 + 1 bedcover 30000 = 62000
      discount_amount: 9300, // 15% dari 62000
      delivery_fee: 10000,
      total: 62700,
      notes: "Mohon pewangi aroma ocean fresh, baju kemeja digantung.",
      created_at: new Date(Date.now() - 3 * 86400000), // 3 hari lalu
    },
  });

  // Items untuk Order 1
  await prisma.orderItem.createMany({
    data: [
      {
        order_id: order1.id,
        service_id: sKiloanKomplit.id,
        quantity: 4.0,
        unit_price: 8000, // Snapshot harga
        subtotal: 32000,
        note: "Pakaian harian warna cerah",
      },
      {
        order_id: order1.id,
        service_id: sBedCover.id,
        quantity: 1,
        unit_price: 30000, // Snapshot harga
        subtotal: 30000,
        note: "Bed cover king abu-abu",
      },
    ],
  });

  // Pembayaran untuk Order 1
  await prisma.payment.create({
    data: {
      order_id: order1.id,
      method: "qris",
      amount: 62700,
      status: "paid",
      gateway_ref: "MIDTRANS-QRIS-9823741",
      paid_at: new Date(Date.now() - 3 * 86400000 + 1800000),
    },
  });

  // Pengiriman jemput & antar untuk Order 1
  await prisma.delivery.create({
    data: {
      order_id: order1.id,
      courier_id: kurir.id,
      address_id: address1.id,
      type: "pickup",
      scheduled_at: new Date(Date.now() - 3 * 86400000 + 3600000),
      status: "done",
    },
  });

  await prisma.delivery.create({
    data: {
      order_id: order1.id,
      courier_id: kurir.id,
      address_id: address1.id,
      type: "delivery",
      scheduled_at: new Date(Date.now() - 86400000),
      status: "done",
    },
  });

  // Status Logs untuk Order 1 (Audit trail lengkap)
  await prisma.orderStatusLog.createMany({
    data: [
      {
        order_id: order1.id,
        status: "pending",
        changed_by: customer1.id,
        note: "Pesanan online dibuat oleh pelanggan",
        created_at: new Date(Date.now() - 3 * 86400000),
      },
      {
        order_id: order1.id,
        status: "picked_up",
        changed_by: kurir.id,
        note: "Cucian telah dijemput kurir dari alamat",
        created_at: new Date(Date.now() - 3 * 86400000 + 4000000),
      },
      {
        order_id: order1.id,
        status: "received",
        changed_by: kasir.id,
        note: "Diterima outlet & ditimbang aktual: 4.0 kg",
        created_at: new Date(Date.now() - 3 * 86400000 + 7200000),
      },
      {
        order_id: order1.id,
        status: "washing",
        changed_by: kasir.id,
        note: "Proses pencucian dimulai",
        created_at: new Date(Date.now() - 2 * 86400000),
      },
      {
        order_id: order1.id,
        status: "ironing",
        changed_by: kasir.id,
        note: "Proses setrika uap & QC",
        created_at: new Date(Date.now() - 1.5 * 86400000),
      },
      {
        order_id: order1.id,
        status: "ready",
        changed_by: kasir.id,
        note: "Cucian rapi & siap diantar",
        created_at: new Date(Date.now() - 1.2 * 86400000),
      },
      {
        order_id: order1.id,
        status: "delivering",
        changed_by: kurir.id,
        note: "Kurir dalam perjalanan mengantar cucian",
        created_at: new Date(Date.now() - 86400000),
      },
      {
        order_id: order1.id,
        status: "completed",
        changed_by: kurir.id,
        note: "Pesanan telah diterima pelanggan dengan baik",
        created_at: new Date(Date.now() - 86400000 + 1800000),
      },
    ],
  });

  // Review untuk Order 1
  await prisma.review.create({
    data: {
      order_id: order1.id,
      customer_id: customer1.id,
      rating: 5,
      comment: "Layanan sangat cepat, wangi tahan lama, lipatan super rapi! Pasti langganan di sini.",
    },
  });

  // Notifikasi untuk Order 1
  await prisma.notification.create({
    data: {
      user_id: customer1.id,
      order_id: order1.id,
      channel: "whatsapp",
      message: "Halo Ahmad! Pesanan laundry Anda #LDR-20261108-001 telah SELESAI diantar. Terima kasih atas kepercayaan Anda!",
      status: "sent",
      sent_at: new Date(Date.now() - 86400000 + 1900000),
    },
  });

  // 9. Seed Sample Order 2: Sedang Dicuci (Washing) dengan Penyesuaian Berat
  console.log("📦 Membuat pesanan contoh 2 (Sedang proses cuci / Washing)...");
  const order2 = await prisma.order.create({
    data: {
      order_no: "LDR-20261109-002",
      customer_id: customer2.id,
      outlet_id: outlet1.id,
      order_source: "online",
      fulfillment_type: "pickup_delivery",
      status: "washing",
      subtotal: 48000, // 3 kg x 16000 (Express 6 jam)
      discount_amount: 0,
      delivery_fee: 10000,
      total: 58000,
      notes: "Pisahkan pakaian putih dan berwarna.",
      created_at: new Date(Date.now() - 14400000), // 4 jam lalu
    },
  });

  await prisma.orderItem.create({
    data: {
      order_id: order2.id,
      service_id: sExpress6H.id,
      quantity: 3.0,
      unit_price: 16000,
      subtotal: 48000,
      note: "Pakaian express 6 jam",
    },
  });

  await prisma.payment.create({
    data: {
      order_id: order2.id,
      method: "ewallet",
      amount: 58000,
      status: "paid",
      gateway_ref: "GOPAY-TRX-1029384",
      paid_at: new Date(Date.now() - 14000000),
    },
  });

  await prisma.delivery.create({
    data: {
      order_id: order2.id,
      courier_id: kurir.id,
      address_id: address2.id,
      type: "pickup",
      scheduled_at: new Date(Date.now() - 13000000),
      status: "done",
    },
  });

  await prisma.orderStatusLog.createMany({
    data: [
      {
        order_id: order2.id,
        status: "pending",
        changed_by: customer2.id,
        note: "Pesanan express dibuat",
        created_at: new Date(Date.now() - 14400000),
      },
      {
        order_id: order2.id,
        status: "picked_up",
        changed_by: kurir.id,
        note: "Dijemput kurir dari Perumahan Way Halim Permai",
        created_at: new Date(Date.now() - 12000000),
      },
      {
        order_id: order2.id,
        status: "received",
        changed_by: kasir.id,
        note: "Penimbangan aktual di outlet Kedaton: 3.0 kg (sesuai)",
        created_at: new Date(Date.now() - 10000000),
      },
      {
        order_id: order2.id,
        status: "washing",
        changed_by: kasir.id,
        note: "Proses pencucian mesin express berjalan",
        created_at: new Date(Date.now() - 7200000),
      },
    ],
  });

  // 10. Seed Sample Order 3: Walk-in Kasir (Drop-off langsung ke outlet)
  console.log("📦 Membuat pesanan contoh 3 (Walk-in Kasir)...");
  const order3 = await prisma.order.create({
    data: {
      order_no: "LDR-20261110-003",
      customer_id: customer1.id,
      outlet_id: outlet1.id,
      order_source: "walk_in",
      fulfillment_type: "drop_off",
      status: "ready",
      subtotal: 35000,
      discount_amount: 0,
      delivery_fee: 0,
      total: 35000,
      notes: "Pelanggan antar langsung ke kasir",
      created_at: new Date(Date.now() - 7200000),
    },
  });

  await prisma.orderItem.create({
    data: {
      order_id: order3.id,
      service_id: sJas.id,
      quantity: 1,
      unit_price: 35000,
      subtotal: 35000,
      note: "Jas blazer warna hitam",
    },
  });

  await prisma.payment.create({
    data: {
      order_id: order3.id,
      method: "cash",
      amount: 35000,
      status: "paid",
      paid_at: new Date(Date.now() - 7200000),
    },
  });

  await prisma.orderStatusLog.createMany({
    data: [
      {
        order_id: order3.id,
        status: "received",
        changed_by: kasir.id,
        note: "Diterima langsung di kasir outlet Tebet",
        created_at: new Date(Date.now() - 7200000),
      },
      {
        order_id: order3.id,
        status: "washing",
        changed_by: kasir.id,
        note: "Proses pencucian khusus",
        created_at: new Date(Date.now() - 5000000),
      },
      {
        order_id: order3.id,
        status: "ready",
        changed_by: kasir.id,
        note: "Selesai disetrika dan digantung, siap diambil pelanggan",
        created_at: new Date(Date.now() - 1800000),
      },
    ],
  });

  console.log("✅ Seeding database berhasil diselesaikan!");
  console.log("--------------------------------------------------");
  console.log("Akun Demo untuk Pengujian:");
  console.log("1. Admin   : admin@laundryhub.com   / Password123! (081234567890)");
  console.log("2. Kasir   : kasir@laundryhub.com   / Password123! (081234567891)");
  console.log("3. Kurir   : kurir@laundryhub.com   / Password123! (081234567892)");
  console.log("4. Customer: ahmad.fauzi@gmail.com  / Password123! (081234567893)");
  console.log("5. Customer: dewi.anggraini@gmail.com / Password123! (081234567894)");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
