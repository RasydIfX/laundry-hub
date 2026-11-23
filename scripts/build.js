const { execSync } = require("child_process");

const dbUrl = process.env.DATABASE_URL || "";
const isVercelOrPostgres =
  Boolean(process.env.VERCEL) ||
  dbUrl.startsWith("postgres://") ||
  dbUrl.startsWith("postgresql://");

if (isVercelOrPostgres) {
  console.log("🚀 Lingkungan Vercel / PostgreSQL terdeteksi.");
  if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    console.log("📦 Melakukan sinkronisasi schema PostgreSQL (prisma db push)...");
    try {
      execSync("npx prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss", {
        stdio: "inherit",
      });
      console.log("✅ Schema database PostgreSQL berhasil disinkronkan.");
    } catch (err) {
      console.warn("⚠️ Peringatan db push:", err.message);
    }
  }

  console.log("⚙️ Men-generate Prisma Client untuk PostgreSQL...");
  execSync("npx prisma generate --schema=prisma/schema.postgresql.prisma", {
    stdio: "inherit",
  });

  console.log("🏗️ Mengompilasi Next.js production build...");
  execSync("npx next build", {
    stdio: "inherit",
  });
} else {
  console.log("💻 Lingkungan lokal terdeteksi. Menjalankan build standar...");
  try {
    execSync("npx prisma generate", {
      stdio: "inherit",
    });
  } catch (err) {
    console.warn("ℹ️ Prisma generate lokal dilewati (file DLL sedang digunakan):", err.message);
  }
  execSync("npx next build", {
    stdio: "inherit",
  });
}

console.log("✨ Build selesai!");
