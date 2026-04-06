import PKLBallLogo from "@/components/PKLBallLogo";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/30 blur-[150px] -top-48 -right-32 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary/15 blur-[120px] -bottom-32 -left-24 pointer-events-none" />
      <div className="relative flex flex-col items-center gap-5">
        <PKLBallLogo size="hero" variant="dark" />
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-muted-foreground">Court Connect</p>
        <div className="flex gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
