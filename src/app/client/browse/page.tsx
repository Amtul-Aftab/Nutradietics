import { redirect } from "next/navigation";

// The temporary Phase 4.4 browse/book UI has been replaced by the AI-driven
// intake flow (Phase 10). Redirect any old links to the intake wizard, whose
// final step is the AI match-result view with the matched professional's slots.
export default function BrowseRedirectPage() {
  redirect("/client/intake");
}
