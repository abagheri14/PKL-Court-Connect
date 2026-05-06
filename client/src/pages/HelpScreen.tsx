import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MessageCircle, Mail, ChevronRight, Search, HelpCircle, Book, Shield, FileText, LockKeyhole, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqEntries = [
  { qKey: "faq_matching", aKey: "faq_matchingAnswer" },
  { qKey: "faq_xp", aKey: "faq_xpAnswer" },
  { qKey: "faq_skill", aKey: "faq_skillAnswer" },
  { qKey: "faq_data", aKey: "faq_dataAnswer" },
  { qKey: "faq_endorsements", aKey: "faq_endorsementsAnswer" },
  { qKey: "faq_courts", aKey: "faq_courtsAnswer" },
  { qKey: "faq_premium", aKey: "faq_premiumAnswer" },
  { qKey: "faq_report", aKey: "faq_reportAnswer" },
  { qKey: "faq_sampleSize", aKey: "faq_sampleSizeAnswer" },
  { qKey: "faq_courtImports", aKey: "faq_courtImportsAnswer" },
];

export default function HelpScreen() {
  const { t } = useTranslation();
  const { navigate, goBack } = useApp();
  const faqs = faqEntries.map(f => ({ q: t(`help.${f.qKey}`), a: t(`help.${f.aKey}`) }));
  const [search, setSearch] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeGuide, setActiveGuide] = useState<string | null>(null);

  const filteredFaqs = faqs.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  );

  const guides: Record<string, { title: string; content: string[] }> = {
    "Getting Started": {
      title: t("help.guideGettingStartedTitle"),
      content: [
        t("help.guideGettingStarted1"),
        t("help.guideGettingStarted2"),
        t("help.guideGettingStarted3"),
        t("help.guideGettingStarted4"),
        t("help.guideGettingStarted5"),
        t("help.guideGettingStarted6"),
      ],
    },
    "Safety Guide": {
      title: t("help.guideSafetyTitle"),
      content: [
        t("help.guideSafety1"),
        t("help.guideSafety2"),
        t("help.guideSafety3"),
        t("help.guideSafety4"),
        t("help.guideSafety5"),
        t("help.guideSafety6"),
      ],
    },
    "Terms of Service": {
      title: t("help.guideTermsTitle"),
      content: [
        t("help.guideTerms1"),
        t("help.guideTerms2"),
        t("help.guideTerms3"),
        t("help.guideTerms4"),
        t("help.guideTerms5"),
        t("help.guideTerms6"),
      ],
    },
    "Privacy Policy": {
      title: t("help.guidePrivacyTitle"),
      content: [
        t("help.guidePrivacy1"),
        t("help.guidePrivacy2"),
        t("help.guidePrivacy3"),
        t("help.guidePrivacy4"),
        t("help.guidePrivacy5"),
        t("help.guidePrivacy6"),
      ],
    },
    "Community Rules": {
      title: t("help.guideCommunityTitle"),
      content: [
        t("help.guideCommunity1"),
        t("help.guideCommunity2"),
        t("help.guideCommunity3"),
        t("help.guideCommunity4"),
        t("help.guideCommunity5"),
        t("help.guideCommunity6"),
      ],
    },
  };

  return (
    <div className="pb-24 min-h-screen">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-muted/20">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{t("help.title")}</h1>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("help.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
      </div>

      {/* Guide Overlay */}
      {activeGuide && guides[activeGuide] && (
        <div className="px-4 pb-4">
          <div className="card-elevated rounded-xl p-4 border-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">{guides[activeGuide].title}</h3>
              <button onClick={() => setActiveGuide(null)} className="p-1 rounded-full hover:bg-muted/20">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {guides[activeGuide].content.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        <button onClick={() => setActiveGuide(activeGuide === "Getting Started" ? null : "Getting Started")} className={cn("card-elevated rounded-xl p-3 text-center transition-all", activeGuide === "Getting Started" && "border-secondary/40 bg-secondary/5")}>
          <Book size={20} className="mx-auto text-secondary mb-1" />
          <p className="text-xs font-medium">{t("help.gettingStarted")}</p>
        </button>
        <button onClick={() => setActiveGuide(activeGuide === "Safety Guide" ? null : "Safety Guide")} className={cn("card-elevated rounded-xl p-3 text-center transition-all", activeGuide === "Safety Guide" && "border-secondary/40 bg-secondary/5")}>
          <Shield size={20} className="mx-auto text-secondary mb-1" />
          <p className="text-xs font-medium">{t("help.safetyGuide")}</p>
        </button>
        <button onClick={() => setActiveGuide(activeGuide === "Terms of Service" ? null : "Terms of Service")} className={cn("card-elevated rounded-xl p-3 text-center transition-all", activeGuide === "Terms of Service" && "border-secondary/40 bg-secondary/5")}>
          <FileText size={20} className="mx-auto text-secondary mb-1" />
          <p className="text-xs font-medium">{t("help.termsOfService")}</p>
        </button>
        <button onClick={() => setActiveGuide(activeGuide === "Privacy Policy" ? null : "Privacy Policy")} className={cn("card-elevated rounded-xl p-3 text-center transition-all", activeGuide === "Privacy Policy" && "border-secondary/40 bg-secondary/5")}>
          <LockKeyhole size={20} className="mx-auto text-secondary mb-1" />
          <p className="text-xs font-medium">{t("help.privacyPolicy")}</p>
        </button>
        <button onClick={() => setActiveGuide(activeGuide === "Community Rules" ? null : "Community Rules")} className={cn("card-elevated rounded-xl p-3 text-center transition-all", activeGuide === "Community Rules" && "border-secondary/40 bg-secondary/5")}>
          <HelpCircle size={20} className="mx-auto text-secondary mb-1" />
          <p className="text-xs font-medium">{t("help.communityRules")}</p>
        </button>
      </div>

      {/* FAQ */}
      <div className="px-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("help.faqTitle")}
        </h2>
        <div className="space-y-2">
          {filteredFaqs.map((faq, i) => (
            <div key={i} className="card-elevated rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between"
              >
                <span className="text-sm font-medium flex-1 pr-2">{faq.q}</span>
                <ChevronRight
                  size={14}
                  className={cn("text-muted-foreground transition-transform", expandedIndex === i && "rotate-90")}
                />
              </button>
              {expandedIndex === i && (
                <div className="px-4 pb-4 -mt-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="px-4 mt-6">
        <div className="card-elevated rounded-xl p-4 text-center">
          <MessageCircle size={24} className="mx-auto text-secondary mb-2" />
          <h3 className="text-sm font-semibold mb-1">{t("help.stillNeedHelp")}</h3>
          <p className="text-xs text-muted-foreground mb-3">{t("help.reachOut")}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" className="gap-1 border-primary/30" onClick={() => window.location.href = "mailto:support@pklcourtconnect.com?subject=Support%20Request"}>
              <Mail size={12} /> {t("help.emailUs")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
