import { Role } from "@prisma/client";

/** Landing dashboard path for a given role after authentication. */
export function dashboardPathForRole(role: Role): string {
  return role === Role.PROFESSIONAL ? "/professional" : "/client";
}
