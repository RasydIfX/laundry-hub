const { execSync } = require("child_process");

console.log("🚀 Menjalankan build pipeline untuk Vercel...");

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
  console.log("📦 PostgreSQL terdeteksi. Melakukan sinkronisasi schema database (prisma db push)...");
  try {
    execSync("npx prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss", {
      stdio: "inherit",
    });
    console.log("✅ Schema database PostgreSQL berhasil disinkronisasi.");
  } catch (err) {
    console.error("⚠️ Peringatan: Sinkronisasi database gagal, melanjutkan generate client...", err.message);
  }
} else {
  console.log("ℹ️ Database bukan PostgreSQL remote, lewati db push.");
}

console.log("⚙️ Men-generate Prisma Client untuk PostgreSQL...");
execSync("npx prisma generate --schema=prisma/schema.postgresql.prisma", {
  stdio: "inherit",
});

console.log("🏗️ Melakukan kompilasi Next.js build...");
execSync("npx next build", {
  stdio: "inherit",
});

console.log("✨ Build Vercel selesai dengan sukses!");
