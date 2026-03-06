import { Suspense } from "react";
import BuyCreditsClient from "./BuyCreditsClient";

function BuyCreditsFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-[#060807] text-white">Loading credits...</div>;
}

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={<BuyCreditsFallback />}>
      <BuyCreditsClient />
    </Suspense>
  );
}
