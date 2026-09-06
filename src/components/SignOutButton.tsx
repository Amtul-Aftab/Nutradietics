"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => signOut({ redirectTo: "/signin" })}
    >
      Sign out
    </Button>
  );
}
