import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Runs on the Edge runtime (Next.js 16 "proxy" convention, formerly middleware),
// so it uses the Prisma-free base config. The `authorized` callback in
// authConfig gates protected route prefixes.
const { auth } = NextAuth(authConfig);

// Next.js 16 requires a function exported as `proxy` (or default).
export const proxy = auth;

export const config = {
  // Run on everything except static assets, image optimization, and favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
