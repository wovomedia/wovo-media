import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GenerationRow = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

type HistoryBody = {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const rows = await supabaseServiceRoleRequest<GenerationRow[]>(
      `/rest/v1/generations?select=id,input,output,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=25`,
    );

    return NextResponse.json({ history: rows ?? [] });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const body = (await request.json()) as HistoryBody;

    if (!body.input || !body.output) {
      return NextResponse.json({ error: "input and output are required." }, { status: 400 });
    }

    await supabaseServiceRoleRequest("/rest/v1/generations", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: user.id,
        input: body.input,
        output: body.output,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    await supabaseServiceRoleRequest(`/rest/v1/generations?user_id=eq.${user.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
