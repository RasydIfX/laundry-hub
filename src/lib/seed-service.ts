import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export async function runDatabaseSeed(force = false) {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && !force) {
    return { success: true, message: "Database sudah memiliki data pengguna.", seeded: false };
  }

  // 1. Bersihkan data lama jika force = true
  if (force) {
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
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 2. Seed Users
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

  // 3. Outlets
  const outlet1 = await prisma.outlet.create({
    data: {
      name: "LaundryHub Pusat Kedaton",
      address: "Jl. Teuku Umar No. 88, Kedaton, Bandar Lampung (Dekat Mall Boemi Kedaton)",
      phone: "081277889901",
      open_hours: "07:00 - 21:00 WIB",
      is_active: true,
    },
  });

  await prisma.outlet.create({
    data: {
      name: "LaundryHub Cabang Way Halim",
      address: "Jl. Sultan Agung No. 24, Way Halim Permai, Bandar Lampung",
      phone: "081277889902",
      open_hours: "08:00 - 20:00 WIB",
      is_active: true,
    },
  });

  // 4. Categories & Services
  const catKiloan = await prisma.serviceCategory.create({
    data: {
      name: "Kiloan",
      description: "Pakaian sehari-hari ditimbang per kilogram.",
      icon: "Scale",
    },
  });

  const catSatuan = await prisma.serviceCategory.create({
    data: {
      name: "Satuan",
      description: "Perawatan khusus item per item.",
      icon: "Shirt",
    },
  });

  const catExpress = await prisma.serviceCategory.create({
    data: {
      name: "Express",
      description: "Layanan kilat 6 jam atau 24 jam.",
      icon: "Zap",
    },
  });

  const catDryClean = await prisma.serviceCategory.create({
    data: {
      name: "Dry Clean",
      description: "Pembersihan kimiawi ramah serat.",
      icon: "Sparkles",
    },
  });

  await prisma.service.createMany({
    data: [
      { category_id: catKiloan.id, name: "Cuci + Setrika Reguler (2 Hari)", unit: "kg", price: 8000, est_duration_hours: 48, is_active: true },
      { category_id: catKiloan.id, name: "Cuci Kering Lipat Reguler (2 Hari)", unit: "kg", price: 6000, est_duration_hours: 48, is_active: true },
      { category_id: catKiloan.id, name: "Setrika Saja (2 Hari)", unit: "kg", price: 5000, est_duration_hours: 48, is_active: true },
      { category_id: catExpress.id, name: "Cuci + Setrika Express Kilat (6 Jam)", unit: "kg", price: 16000, est_duration_hours: 6, is_active: true },
      { category_id: catExpress.id, name: "Cuci + Setrika Express 1 Hari (24 Jam)", unit: "kg", price: 12000, est_duration_hours: 24, is_active: true },
      { category_id: catSatuan.id, name: "Kemeja / Blus Formal", unit: "pcs", price: 15000, est_duration_hours: 48, is_active: true },
      { category_id: catSatuan.id, name: "Jas / Blazer Satuan", unit: "pcs", price: 35000, est_duration_hours: 72, is_active: true },
      { category_id: catSatuan.id, name: "Bed Cover Sedang / King", unit: "pcs", price: 30000, est_duration_hours: 48, is_active: true },
      { category_id: catSatuan.id, name: "Sepatu Sneakers Deep Clean", unit: "pcs", price: 35000, est_duration_hours: 72, is_active: true },
      { category_id: catDryClean.id, name: "Dry Clean Jas Lengkap", unit: "pcs", price: 65000, est_duration_hours: 72, is_active: true },
    ],
  });

  // 5. Promos
  await prisma.promo.createMany({
    data: [
      { code: "BERSIHHEMAT", discount_type: "percent", discount_value: 15, min_order: 30000, start_date: new Date("2026-01-01"), end_date: new Date("2026-12-31"), quota: 300, is_active: true },
      { code: "DISKON10K", discount_type: "fixed", discount_value: 10000, min_order: 50000, start_date: new Date("2026-01-01"), end_date: new Date("2026-12-31"), quota: 150, is_active: true },
      { code: "PELANGGANBARU", discount_type: "percent", discount_value: 20, min_order: 25000, start_date: new Date("2026-01-01"), end_date: new Date("2026-12-31"), quota: 500, is_active: true },
    ],
  });

  return { success: true, message: "Database berhasil diinisialisasi dengan data default.", seeded: true };
}
