import { redirect } from "next/navigation";

// The old client-workspace marketing page described bookings, a weekly plan and
// staff assignment, none of which is how WOVO V2 works. Nothing links here any
// more, so send visitors to the product itself.
export default function WorkspaceRedirect() {
  redirect("/");
}
