import type { Role, ProfessionalType } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    professionalType?: ProfessionalType | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      professionalType: ProfessionalType | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    professionalType: ProfessionalType | null;
  }
}
