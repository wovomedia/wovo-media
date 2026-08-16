import Link from "next/link";

type WovoLogoProps = {
  variant?: "full" | "icon" | "ai";
  className?: string;
  href?: string;
  size?: number;
};

function Logo({ variant }: { variant: "full" | "icon" | "ai" }) {
  if (variant === "icon") {
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
        <rect width="38" height="38" rx="10" fill="#191714" />
        <path d="M7 11h5l3.2 15 3.5-11h.6l3.5 11L26 11h5l-5 17h-5l-2-6-2 6h-5L7 11Z" fill="#F3EFE6" />
        <circle cx="31" cy="7" r="4" fill="#F05A3A" />
      </svg>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-xl font-black leading-none tracking-[-0.075em]">WOVO</span>
      <span className="rounded-full border border-current/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]">
        {variant === "ai" ? "Workspace" : "Media"}
      </span>
    </span>
  );
}

export default function WovoLogo({ variant = "full", className = "", href = "/", size }: WovoLogoProps) {
  const style = size ? { width: size } : undefined;
  const logo = <Logo variant={variant} />;
  if (!href) return <span className={`inline-flex min-h-11 items-center ${className}`} style={style}>{logo}</span>;
  return <Link href={href} className={`inline-flex min-h-11 items-center ${className}`} style={style} aria-label="WOVO Media home">{logo}</Link>;
}
