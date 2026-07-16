import * as jose from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-mantharai-hostel-complaint-system-2026";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "hostel_session";

export interface SessionPayload {
  userId: string;
  role: "ADMIN" | "STUDENT" | "RC";
  registrationNumber?: string | null;
  tokenVersion: number;
  mustChangePassword: boolean;
}

/**
 * Sign a JWT token
 */
export async function signToken(payload: SessionPayload): Promise<string> {
  const payloadMap = { ...payload } as Record<string, any>;
  return await new jose.SignJWT(payloadMap)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET_KEY);
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get authenticated user from session cookie.
 * This also performs database checks for active status and token version mismatch.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Retrieve user details from database to check is_active and token_version
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      registration_number: true,
      role: true,
      room_number: true,
      must_change_password: true,
      is_active: true,
      token_version: true,
    },
  });

  if (!user || !user.is_active || user.token_version !== payload.tokenVersion) {
    return null;
  }

  return user;
}

/**
 * Check CSRF Origin/Referer headers.
 * Validates that requests modifying state come from the same origin.
 */
export function validateCSRF(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${host}`;

  if (origin) {
    return origin === appUrl || origin.replace(/^https?:\/\//, "") === host;
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host === host;
    } catch {
      return false;
    }
  }

  // If both origin and referer are missing, reject for safety in state-changing requests
  return false;
}
