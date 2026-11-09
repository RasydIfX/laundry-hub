import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "laundryhub_super_secret_jwt_key_2026_xyz";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface TokenPayload {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string; // "customer" | "admin" | "kasir" | "kurir"
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies JWT from Request Authorization Header or Cookie
 */
export async function getAuthUser(req: Request): Promise<TokenPayload | null> {
  let token: string | null = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to cookie if present
  if (!token) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // Verify that the user still exists and is active in database
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, phone: true, email: true, role: true, is_active: true },
  });

  if (!user || !user.is_active) return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
  };
}

/**
 * Guard helper for Next.js App Router Route Handlers
 */
export async function requireAuth(
  req: Request,
  allowedRoles?: string[]
): Promise<{ user: TokenPayload | null; errorResponse: Response | null }> {
  const user = await getAuthUser(req);

  if (!user) {
    return {
      user: null,
      errorResponse: Response.json(
        { success: false, error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      errorResponse: Response.json(
        {
          success: false,
          error: `Akses dilarang. Peran '${user.role}' tidak memiliki izin untuk tindakan ini.`,
        },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
