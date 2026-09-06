import type { NextAuthConfig } from "next-auth";
import type { Role, ProfessionalType } from "@prisma/client";

/**
 * Edge-safe Auth.js configuration shared between middleware and the full
 * server config. This file must NOT import Prisma, bcrypt, or other Node-only
 * modules, because it is evaluated in the Edge runtime by middleware.
 */

// Route prefixes that require authentication.
const PROTECTED_PREFIXES = ["/dashboard", "/client", "/professional"];

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
        token.professionalType = user.professionalType ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
        session.user.professionalType =
          token.professionalType as ProfessionalType | null;
      }
      return session;
    },
    // Gate protected route prefixes; redirect unauthenticated users to sign-in.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (!isProtected) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
