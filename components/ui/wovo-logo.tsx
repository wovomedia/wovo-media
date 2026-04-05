import Image from "next/image";
import Link from "next/link";

type WovoLogoProps = {
  variant?: "full" | "icon" | "ai";
  className?: string;
  href?: string;
};

function LogoSVG({ variant = "full" }: { variant?: "full" | "icon" | "ai" }) {
  if (variant === "icon") {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect width="36" height="36" rx="8" fill="#5CB85C"/>
        <text x="18" y="26" textAnchor="middle" fontSize="22" fontWeight="800" fontFamily="Arial Rounded MT Bold, Arial, sans-serif" fill="white">W</text>
      </svg>
    );
  }

  if (variant === "ai") {
    return (
      <span className="flex items-center gap-2">
        <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect width="36" height="36" rx="8" fill="#5CB85C"/>
          <text x="18" y="26" textAnchor="middle" fontSize="22" fontWeight="800" fontFamily="Arial Rounded MT Bold, Arial, sans-serif" fill="white">W</text>
        </svg>
        <span className="flex flex-col leading-none">
          <span style={{ color: "#5CB85C", fontWeight: 900, fontSize: "1.1rem", fontFamily: "Arial Rounded MT Bold, Arial, sans-serif", letterSpacing: "-0.02em" }}>Wovo</span>
          <span style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.65rem", fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive", letterSpacing: "0.08em" }}>Media AI</span>
        </span>
      </span>
    );
  }

  // Full logo — matches the physical logo: green Wovo + black Media
  return (
    <span className="flex flex-col leading-none select-none">
      <span style={{ color: "#5CB85C", fontWeight: 900, fontSize: "1.45rem", fontFamily: "Arial Rounded MT Bold, Arial, sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
        Wovo
      </span>
      <span style={{ color: "#1a1a1a", fontWeight: 700, fontSize: "0.8rem", fontFamily: "'Comic Sans MS', 'Chalkboard SE', cursive", letterSpacing: "0.06em", lineHeight: 1, textAlign: "right" }}>
        Media
      </span>
    </span>
  );
}

export default function WovoLogo({ variant = "full", className = "", href = "/" }: WovoLogoProps) {
  const logo = <LogoSVG variant={variant} />;
  if (!href) return <span className={className}>{logo}</span>;
  return (
    <Link href={href} className={`inline-flex items-center ${className}`} aria-label="Wovo Media home">
      {logo}
    </Link>
  );
}
