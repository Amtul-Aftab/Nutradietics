import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { professional: true },
        });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Email verification is NON-BLOCKING (Req 17, revised): the
        // verification email is still issued/sent best-effort at signup, but
        // sign-in does NOT require emailVerified. This avoids locking out
        // users whose provider (e.g. Resend sandbox) can't deliver to their
        // address. `emailVerified` remains available for future gating/UX.

        // Returned object is persisted into the JWT via callbacks.
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          professionalType: user.professional?.type ?? null,
        };
      },
    }),
  ],
});
