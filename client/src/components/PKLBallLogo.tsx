import { cn } from "@/lib/utils";

interface PKLBallLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  showText?: boolean;
  className?: string;
  variant?: "dark" | "light" | "auto";
}

// Heights in px — width is auto to preserve the logo's natural aspect ratio
const heightMap = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 56,
  xl: 80,
  hero: 120,
};

function isLightMode() {
  return typeof document !== "undefined" && !document.documentElement.classList.contains("dark");
}

export default function PKLBallLogo({
  size = "md",
  variant = "auto",
  className,
}: PKLBallLogoProps) {
  const h = heightMap[size];
  const invert = variant === "light" || (variant === "auto" && isLightMode());

  return (
    <img
      src="/P_WhiteMainLogo-PKLBALL256.png"
      alt="PKLBALL"
      height={h}
      style={{ height: h, width: "auto", ...(invert ? { filter: "invert(1)" } : {}) }}
      className={cn("block mx-auto object-contain select-none shrink-0", className)}
    />
  );
}

/** Standalone icon-only version — uses same image, square crop via object sizing */
export function PKLBallIcon({ size = 28, className }: { size?: number; className?: string }) {
  const invert = isLightMode();

  return (
    <img
      src="/P_WhiteMainLogo-PKLBALL256.png"
      alt="PKLBALL"
      height={size}
      style={{ height: size, width: "auto", ...(invert ? { filter: "invert(1)" } : {}) }}
      className={cn("object-contain select-none shrink-0", className)}
    />
  );
}
