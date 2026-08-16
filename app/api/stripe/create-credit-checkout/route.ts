import { NextResponse } from "next/server";
import { startCreditCheckout } from "@/lib/portal/credit-checkout";
import { PortalHttpError, requirePortalContext } from "@/lib/portal/server";

export async function POST(request: Request) {
  try {
    const context = await requirePortalContext(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    return NextResponse.json(await startCreditCheckout(request, context, body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PortalHttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Credit checkout failed.";
    if (message.includes("Missing bearer token") || message.includes("Unable to verify session")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Credit checkout failed", { message: message.slice(0, 160) });
    return NextResponse.json({ error: "Credit checkout could not be started." }, { status: 500 });
  }
}
