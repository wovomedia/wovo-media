import { redirect } from "next/navigation";

// Public creator profiles belonged to the legacy WOVO AI social product. WOVO
// has one customer-facing surface now, and generated work is private to the
// workspace that made it.
export default function CreatorProfileRedirect() {
  redirect("/portal");
}
