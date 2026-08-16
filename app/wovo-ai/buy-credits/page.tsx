import { redirect } from "next/navigation";

export default function BuyCreditsPage() {
  // The legacy user-level credit packs were not tenant-bound and could show a
  // success message before Stripe webhook confirmation. Keep the route closed
  // until the workspace-scoped Checkout + ledger release gate is complete.
  redirect("/portal");
}
