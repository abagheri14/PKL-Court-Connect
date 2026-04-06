import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function TutorialOverlay() {
  const { navigate } = useApp();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const tutorialSteps = [
    { icon: "🏓", title: t("tutorial.step1Title"), description: t("tutorial.step1Desc") },
    { icon: "💬", title: t("tutorial.step2Title"), description: t("tutorial.step2Desc") },
    { icon: "📍", title: t("tutorial.step3Title"), description: t("tutorial.step3Desc") },
    { icon: "🎮", title: t("tutorial.step4Title"), description: t("tutorial.step4Desc") },
  ];
  const current = tutorialSteps[step];

  const finish = () => {
    localStorage.setItem("pkl_tutorial_seen", "1");
    navigate("home");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/30 blur-[120px] -top-40 -right-20" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px] -bottom-40 -left-20" />

      <div className="relative z-10 w-full max-w-sm text-center space-y-8">
        <div className="text-8xl">{current.icon}</div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">{current.title}</h2>
          <p className="text-muted-foreground">{current.description}</p>
        </div>

        {/* Dots */}
        <div className="flex gap-2 justify-center">
          {tutorialSteps.map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === step ? "bg-secondary w-6" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="space-y-3">
          {step < tutorialSteps.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="w-full bg-primary text-white h-11">
              {t("tutorial.next")}
            </Button>
          ) : (
            <Button onClick={finish} className="w-full bg-secondary text-secondary-foreground font-semibold h-11">
              {t("tutorial.letsGo")} 🚀
            </Button>
          )}
          {step < tutorialSteps.length - 1 && (
            <button onClick={finish} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
              {t("tutorial.skip")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
