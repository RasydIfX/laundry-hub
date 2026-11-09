import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const profile = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      created_at: true,
      addresses: {
        orderBy: [{ is_default: "desc" }, { id: "desc" }],
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: profile,
  });
}
