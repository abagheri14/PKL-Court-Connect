import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PKLBallLogo from "@/components/PKLBallLogo";

function InputField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  hint,
  showToggle,
  showValue,
  onToggleShow,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
  showToggle?: boolean;
  showValue?: boolean;
  onToggleShow?: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-foreground/70 tracking-wide uppercase pl-0.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={showToggle ? (showValue ? "text" : "password") : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={cn(
            "w-full h-[52px] rounded-xl px-4 bg-muted/50 border text-foreground text-[15px] outline-none transition-colors",
            showToggle && "pr-12",
            focused
              ? "border-primary bg-muted/70"
              : "border-border hover:border-border/80"
          )}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showValue ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground/60 pl-0.5">{hint}</p>}
    </div>
  );
}

export default function LoginScreen() {
  const { login, signup } = useApp();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) toast.error(result.error || t("auth.invalidCredentials"));
    } catch {
      toast.error(t("auth.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) { toast.error(t("auth.passwordMinLength")); return; }
    if (!username.trim()) { toast.error(t("auth.usernameRequired")); return; }
    setLoading(true);
    try {
      const result = await signup({ email, password, username: username.trim() });
      if (!result.success) toast.error(result.error || t("auth.signupFailed"));
    } catch {
      toast.error(t("auth.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* ── Hero background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-background to-background" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/25 blur-[140px] -top-48 left-1/2 -translate-x-1/2" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary/15 blur-[120px] bottom-0 -right-32" />
        {/* Pickleball court lines — subtle */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect x="10%" y="5%" width="80%" height="75%" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="50%" y1="5%" x2="50%" y2="80%" stroke="currentColor" strokeWidth="1" strokeDasharray="6,4"/>
          <rect x="26%" y="5%" width="48%" height="25%" fill="none" stroke="currentColor" strokeWidth="1"/>
          <rect x="26%" y="55%" width="48%" height="25%" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50%" cy="42.5%" r="5%" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="10%" y1="42.5%" x2="90%" y2="42.5%" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </div>

      {/* ── Scroll content ── */}
      <div className="relative z-10 flex flex-col min-h-[100dvh]">

        {/* ── Brand hero ── */}
        <div className="flex flex-col items-center pt-20 pb-8 px-6">
          {/* Logo */}
          <div className="mb-6">
            <PKLBallLogo size="xl" variant="dark" />
          </div>

          <h1 className="text-[28px] font-bold tracking-tight leading-[1.1] text-center">
            <span className="text-foreground">{t("auth.courtConnect")}</span>
          </h1>
          <p className="text-muted-foreground text-[15px] mt-2 text-center">
            {t("auth.tagline")}
          </p>
        </div>

        {/* ── Form panel ── */}
        <div className="flex-1 flex flex-col">
          <div
            className="flex-1 rounded-t-[28px] border-t border-border bg-background/80 px-6 pt-7 pb-10 flex flex-col"
            style={{ backdropFilter: "blur(24px)" }}
          >
            {/* Tab switcher */}
            <div className="flex gap-0 mb-7 border-b border-border">
              {(["signin", "signup"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 pb-3 text-[14px] font-bold tracking-wide transition-all border-b-2 -mb-px",
                    mode === m
                      ? "text-foreground border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground/70"
                  )}
                >
                  {m === "signin" ? t("auth.signIn") : t("auth.createAccount")}
                </button>
              ))}
            </div>

            {/* Sign In */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <InputField
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  required
                />
                <InputField
                  label={t("auth.password")}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  required
                  showToggle
                  showValue={showPassword}
                  onToggleShow={() => setShowPassword(v => !v)}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full h-[54px] rounded-xl font-bold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.55 0.18 295), oklch(0.50 0.22 300))",
                    boxShadow: "0 8px 32px rgba(107,46,159,0.50)",
                  }}
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : t("auth.signInButton")}
                </button>
              </form>
            )}

            {/* Sign Up */}
            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <InputField
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  required
                />
                <InputField
                  label={t("auth.username")}
                  type="text"
                  value={username}
                  onChange={setUsername}
                  autoComplete="username"
                  required
                  hint={t("auth.usernameHint")}
                />
                <InputField
                  label={t("auth.password")}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  hint={t("auth.passwordHint")}
                  showToggle
                  showValue={showPassword}
                  onToggleShow={() => setShowPassword(v => !v)}
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full h-[54px] rounded-xl font-bold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.55 0.18 295), oklch(0.50 0.22 300))",
                    boxShadow: "0 8px 32px rgba(107,46,159,0.50)",
                  }}
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : t("auth.createAccountButton")}
                </button>
              </form>
            )}

            <p className="text-center text-[11px] text-muted-foreground/60 mt-auto pt-8">
              {t("auth.termsNotice")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


