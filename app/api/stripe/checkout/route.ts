import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  void _request;
  return NextResponse.json(
    {
      error: "This legacy checkout is closed. Choose a current WOVO plan through the verified portal activation flow.",
      code: "legacy_checkout_closed",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
