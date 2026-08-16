import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  void _request;
  return NextResponse.json(
    {
      error: "Credit top-ups are unavailable until WOVO verifies the tenant-scoped Stripe Checkout and ledger flow.",
      code: "credit_checkout_not_verified",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
