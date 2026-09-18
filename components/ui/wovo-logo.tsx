import Image from "next/image";
import Link from "next/link";

type WovoLogoProps = {
  variant?: "full" | "icon" | "ai";
  className?: string;
  href?: string;
  size?: number;
};

function Logo({ variant, size = 38 }: { variant: "full" | "icon" | "ai"; size?: number }) {
  if (variant === "icon") {
    return (
      <Image
        src="/images/brand/wovo-glow-icon.svg"
        alt=""
        width={size}
        height={size}
        className="h-9 w-9 object-contain"
        priority
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <Image
        src="/images/brand/wovo-glow-icon.svg"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
        priority
      />
      <span className="text-xl font-black leading-none tracking-[-0.075em]">WOVO</span>
      <span className="rounded-full border border-current/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]">
        {variant === "ai" ? "Studio" : "Media"}
      </span>
    </span>
  );
}

export default function WovoLogo({ variant = "full", className = "", href = "/", size }: WovoLogoProps) {
  const logo = <Logo variant={variant} size={size} />;
  if (!href) {
    return (
      <span className={`inline-flex min-h-11 items-center ${className}`}>{logo}</span>
    );
  }
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center ${className}`}
      aria-label="WOVO Media home"
    >
      {logo}
    </Link>
  );
}
