import { cn } from "@/lib/utils";

interface PKLBallLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  showText?: boolean;
  className?: string;
  variant?: "dark" | "light";
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

export default function PKLBallLogo({
  size = "md",
  className,
}: PKLBallLogoProps) {
  const h = heightMap[size];

  return (
    <img
      src="/P_WhiteMainLogo-PKLBALL256.png"
      alt="PKLBALL"
      height={h}
      style={{ height: h, width: "auto" }}
      className={cn("block mx-auto object-contain select-none shrink-0", className)}
    />
  );
}

/** Standalone icon-only version — uses same image, square crop via object sizing */
export function PKLBallIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/P_WhiteMainLogo-PKLBALL256.png"
      alt="PKLBALL"
      height={size}
      style={{ height: size, width: "auto" }}
      className={cn("object-contain select-none shrink-0", className)}
    />
  );
}
