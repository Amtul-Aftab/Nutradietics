import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authConfig } from "@/auth.config";

/**
 * Thrown when credentials are valid but the email is unverified. The `code`
 * rides the sign-in response (surfaced to the client as `signIn(...).code`)
 * so the UI can show a specific message. It is only thrown AFTER the password
 * check passes, so it never reveals verification state for a wrong password.
 */
class UnverifiedEmailError extends CredentialsSignin {
  code = "unverified";
}

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

        // Email verification is required to sign in (Req 17). Checked only
        // after the password is confirmed, so it can't be used to probe
        // whether an account exists / is verified without the password.
        if (user.emailVerified !== true) {
          throw new UnverifiedEmailError();
        }

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
