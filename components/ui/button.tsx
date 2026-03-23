import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonBaseProps = {
  className?: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

const variantClasses: Record<Variant, string> = {
  default:
    "bg-[var(--wm-accent)] text-slate-950 hover:bg-[var(--wm-accent-strong)] shadow-[0_12px_30px_rgba(0,233,145,0.28)]",
  secondary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-300 bg-white text-slate-900 hover:border-slate-400",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

function getAnchorProps(
  props: ButtonAsLink
): Omit<ButtonAsLink, keyof ButtonBaseProps | "href" | "children"> {
  const copy = { ...props } as Record<string, unknown>;
  delete copy.href;
  delete copy.children;
  delete copy.className;
  delete copy.variant;
  delete copy.size;
  return copy as Omit<ButtonAsLink, keyof ButtonBaseProps | "href" | "children">;
}

function getButtonProps(
  props: ButtonAsButton
): Omit<ButtonAsButton, keyof ButtonBaseProps | "href" | "children"> {
  const copy = { ...props } as Record<string, unknown>;
  delete copy.href;
  delete copy.children;
  delete copy.className;
  delete copy.variant;
  delete copy.size;
  return copy as Omit<ButtonAsButton, keyof ButtonBaseProps | "href" | "children">;
}

export function Button(props: ButtonAsButton): ReactNode;
export function Button(props: ButtonAsLink): ReactNode;
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wm-page)] disabled:pointer-events-none disabled:opacity-60",
    variantClasses[props.variant ?? "default"],
    sizeClasses[props.size ?? "md"],
    props.className
  );

  if ("href" in props && typeof props.href === "string") {
    const isExternal =
      props.href.startsWith("http") ||
      props.href.startsWith("mailto:") ||
      props.href.startsWith("tel:") ||
      props.href.startsWith("sms:");

    const anchorProps = getAnchorProps(props);

    if (isExternal) {
      return (
        <a className={classes} href={props.href} {...anchorProps}>
          {props.children}
        </a>
      );
    }

    return (
      <Link className={classes} href={props.href} {...anchorProps}>
        {props.children}
      </Link>
    );
  }

  const buttonProps = getButtonProps(props);

  return (
    <button className={classes} {...buttonProps}>
      {props.children}
    </button>
  );
}
