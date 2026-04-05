"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { OnboardingModal } from "@/components/wovo-ai/onboarding-modal";
import { Button } from "@/components/ui/button";
import { payments } from "@/data/site-content";

const hiddenPrefixes = ["/wovo-ai", "/admin", "/login", "/signup", "/auth"];

export function MobileStickyCta() {
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const shouldRender = useMemo(() => {
    if (!pathname) return false;
    return !hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

  if (!shouldRender) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#10151b]/95 p-3 shadow-[0_-14px_30px_rgba(0,0,0,0.35)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Button size="md" className="h-12 w-full text-sm" type="button" onClick={() => setShowOnboarding(true)}>
            Try Wovo AI ($49/mo)
          </Button>
          <Button size="md" className="h-12 w-full text-sm" href={payments.agencyPremiumCheckout} variant="outline">
            Team Premium ($1,000)
          </Button>
        </div>
      </div>
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
}
