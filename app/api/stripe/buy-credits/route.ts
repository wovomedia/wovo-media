import { POST as createCreditCheckoutRoute } from "@/app/api/stripe/create-credit-checkout/route";

export async function POST(request: Request) {
  return createCreditCheckoutRoute(request);
}
