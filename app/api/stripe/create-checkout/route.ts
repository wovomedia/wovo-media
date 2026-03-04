import { POST as checkoutRoute } from "@/app/api/stripe/checkout/route";

export async function POST(request: Request) {
  return checkoutRoute(request);
}
