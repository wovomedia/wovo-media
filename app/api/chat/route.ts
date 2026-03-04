import { POST as chatRoute } from "@/app/api/wovo-ai/chat/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return chatRoute(request);
}
