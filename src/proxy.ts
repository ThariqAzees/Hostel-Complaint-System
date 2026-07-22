import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-mantharai-hostel-complaint-system-2026";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "hostel_session";

interface SessionPayload {
  userId: string;
  role: "ADMIN" | "STUDENT" | "RC";
  registrationNumber?: string | null;
  tokenVersion: number;
  mustChangePassword: boolean;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // 1. Parse and verify token if present
  let payload: SessionPayload | null = null;
  if (token) {
    try {
      const { payload: verified } = await jose.jwtVerify(token, SECRET_KEY);
      payload = verified as unknown as SessionPayload;
    } catch {
      // Invalid token, clear cookie in response
      if (pathname.startsWith("/api")) {
        const response = new NextResponse(
          JSON.stringify({ error: "Unauthorized access" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
        response.cookies.delete(COOKIE_NAME);
        return response;
      }
      if (pathname === "/login") {
        const response = NextResponse.next();
        response.cookies.delete(COOKIE_NAME);
        return response;
      }
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // 2. Define route guards
  const isLoginPage = pathname === "/login";
  const isChangePasswordPage = pathname === "/change-password";
  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute = pathname.startsWith("/student");
  const isRcRoute = pathname.startsWith("/rc");
  const isApiRoute = pathname.startsWith("/api");

  // Allow static assets, images, etc.
  if (
    pathname.startsWith("/_next") || 
    pathname.includes(".") || 
    pathname.startsWith("/static") ||
    pathname.startsWith("/uploads")
  ) {
    return NextResponse.next();
  }

  // 3. Unauthenticated access logic
  if (!payload) {
    // If trying to access protected dashboards/APIs, redirect to login
    if (isAdminRoute || isStudentRoute || isRcRoute || isChangePasswordPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isApiRoute && !pathname.startsWith("/api/auth/login")) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    return NextResponse.next();
  }

  // 4. Authenticated user redirects
  if (isLoginPage) {
    if (payload.mustChangePassword) {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
    // Redirect to correct dashboard
    if (payload.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } else if (payload.role === "RC") {
      return NextResponse.redirect(new URL("/rc/dashboard", request.url));
    } else if (payload.role === "STUDENT") {
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
  }

  // 5. must_change_password redirect guard
  if (payload.mustChangePassword && !isChangePasswordPage && !pathname.startsWith("/api/auth/change-password") && !pathname.startsWith("/api/auth/logout")) {
    // Redirect to mandatory change password page
    if (isApiRoute) {
      return new NextResponse(
        JSON.stringify({ error: "Password change required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  // 7. Role-based authorization
  if (isAdminRoute && payload.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isRcRoute && payload.role !== "RC") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isStudentRoute && payload.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // API Role-based authorization guards
  if (isApiRoute) {
    if (pathname.startsWith("/api/admin") && payload.role !== "ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    if (pathname.startsWith("/api/rc") && payload.role !== "RC") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: RC access required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    if (pathname.startsWith("/api/student") && payload.role !== "STUDENT") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Student access required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/student/:path*",
    "/rc/:path*",
    "/change-password",
    "/login",
    "/api/:path*",
  ],
};
