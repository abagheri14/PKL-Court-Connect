import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check, Loader2, Camera, Plus, X, Info } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PKLBallLogo from "@/components/PKLBallLogo";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import ImageCropper from "@/components/ImageCropper";

const skillLevels = ["Beginner", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0+"];
const vibes = ["Social", "Competitive", "Both"];
const paces = ["Rally & Flow", "Fast & Aggressive", "Both"];
const basePlayStyles = ["Power Player", "Kitchen Master", "Strategist", "Defender", "All-Courter", "Friendly"];
const allPlayStylesOption = "All of the above";
const playStyles = [...basePlayStyles, allPlayStylesOption];
const goalOptions = ["Recreation", "Tournaments", "Skill Improvement", "Fitness", "Social", "Learn", "Leagues", "Other"];
const availabilities = [
  "Any",
  "Weekday Mornings", "Weekday Afternoons", "Weekday Evenings",
  "Weekend Mornings", "Weekend Afternoons", "Weekend Evenings",
  "Specific date(s)",
];
const courtPrefs = ["Indoor", "Outdoor", "Both"];
const courtAccessPrefs = ["Public", "Private", "Any"];
const presetAvatars = [
  { url: "/avatars/pkl-avatar-lime.svg", labelKey: "onboarding.avatarPresetLime" },
  { url: "/avatars/pkl-avatar-court.svg", labelKey: "onboarding.avatarPresetCourt" },
  { url: "/avatars/pkl-avatar-sky.svg", labelKey: "onboarding.avatarPresetSky" },
  { url: "/avatars/pkl-avatar-rose.svg", labelKey: "onboarding.avatarPresetRose" },
];
const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-Binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];
const handOptions = ["Left", "Right", "Ambidextrous"];

export default function OnboardingFlow() {
  const { refetchUser } = useApp();
  const { t } = useTranslation();
  const completeOnboardingMutation = trpc.users.completeOnboarding.useMutation({
    onError: (err) => toast.error(err.message || t("onboarding.failedSaveProfile")),
  });
  const addPhotoMutation = trpc.photos.add.useMutation({
    onError: (err) => toast.error(err.message),
  });
  const [step, setStep] = useState(0);
  const totalSteps = 6;

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [skill, setSkill] = useState("");
  const [hand, setHand] = useState("Right");
  const [vibe, setVibe] = useState("");
  const [pace, setPace] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [otherGoal, setOtherGoal] = useState("");
  const [avail, setAvail] = useState<string[]>([]);
  const [specificDates, setSpecificDates] = useState("");
  const [courtPref, setCourtPref] = useState("");
  const [courtAccess, setCourtAccess] = useState("Any");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");

  const { uploading, openFilePicker, cropSrc, handleCropComplete, handleCropCancel } = usePhotoUpload({
    enableCrop: true,
    maxSizeMB: 8,
    onSuccess: (url) => {
      setUploadedPhotos(prev => [...prev, url]);
      addPhotoMutation.mutate({ photoUrl: url });
    },
  });

  const toggleArray = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);
  };

  const allPlayStylesSelected = basePlayStyles.every(s => styles.includes(s));
  const displayedPhotos = selectedAvatar ? [selectedAvatar, ...uploadedPhotos.filter(url => url !== selectedAvatar)] : uploadedPhotos;

  const toggleStyle = (style: string) => {
    if (style === allPlayStylesOption) {
      setStyles(allPlayStylesSelected ? [] : basePlayStyles);
      return;
    }
    setStyles(prev => prev.includes(style) ? prev.filter(x => x !== style) : [...prev, style]);
  };

  const toggleAvailability = (item: string) => {
    if (item === "Any") {
      setAvail(prev => prev.includes("Any") ? [] : ["Any"]);
      setSpecificDates("");
      return;
    }
    setAvail(prev => {
      const withoutAny = prev.filter(x => x !== "Any");
      return withoutAny.includes(item) ? withoutAny.filter(x => x !== item) : [...withoutAny, item];
    });
  };

  const buildGoalsSummary = () => {
    const selectedGoals = goals.filter(g => g !== "Other");
    if (goals.includes("Other")) selectedGoals.push(otherGoal.trim() ? `Other: ${otherGoal.trim()}` : "Other");
    return selectedGoals.join(", ");
  };

  const buildAvailabilitySummary = () => {
    const availability = avail.map(item => item === "Specific date(s)" && specificDates.trim() ? `Specific date(s): ${specificDates.trim()}` : item);
    if (courtAccess) availability.push(`Court access: ${courtAccess}`);
    return availability.join(", ");
  };

  const handleFinish = async () => {
    const vibeMap: Record<string, "competitive" | "social" | "both"> = { Competitive: "competitive", Social: "social", Both: "both" };
    const paceMap: Record<string, "fast" | "rally" | "both"> = { "Rally & Flow": "rally", "Fast & Aggressive": "fast", Both: "both" };
    const handMap: Record<string, "left" | "right" | "ambidextrous"> = { Left: "left", Right: "right", Ambidextrous: "ambidextrous" };
    const courtMap: Record<string, "indoor" | "outdoor" | "both"> = { Indoor: "indoor", Outdoor: "outdoor", Both: "both" };
    const genderMap: Record<string, "male" | "female" | "non-binary" | "prefer-not-to-say"> = { male: "male", female: "female", "non-binary": "non-binary", "prefer-not-to-say": "prefer-not-to-say" };
    const anyAvailability = avail.includes("Any");
    const profilePhotoUrl = displayedPhotos[0];
    try {
      await completeOnboardingMutation.mutateAsync({
        name: fullName || undefined,
        nickname: nickname || undefined,
        dateOfBirth: dateOfBirth || undefined,
        skillLevel: skill || "4.0",
        vibe: vibeMap[vibe] || "both",
        pace: paceMap[pace] || "both",
        playStyle: styles.join(", ") || undefined,
        goals: buildGoalsSummary() || undefined,
        availability: buildAvailabilitySummary() || undefined,
        courtPreference: courtMap[courtPref] || "both",
        handedness: handMap[hand] || "right",
        gender: genderMap[gender] || undefined,
        profilePhotoUrl: profilePhotoUrl || undefined,
        hasProfilePhoto: Boolean(profilePhotoUrl),
        availabilityWeekdays: anyAvailability || avail.some(a => a.startsWith("Weekday")),
        availabilityWeekends: anyAvailability || avail.some(a => a.startsWith("Weekend")),
        availabilityMornings: anyAvailability || avail.some(a => a.endsWith("Mornings")),
        availabilityAfternoons: anyAvailability || avail.some(a => a.endsWith("Afternoons")),
        availabilityEvenings: anyAvailability || avail.some(a => a.endsWith("Evenings")),
      });
      refetchUser();
    } catch (err: any) {
      toast.error(err.message || t("onboarding.failedSaveProfile"));
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <PKLBallLogo size="lg" variant="dark" />
              <h2 className="text-2xl font-bold">{t("onboarding.welcomeTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.welcomeDesc")}</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label>{t("onboarding.fullName")}</Label>
                <Input placeholder={t("onboarding.fullNamePlaceholder")} value={fullName} onChange={e => setFullName(e.target.value)} className="bg-background/50 mt-1" />
              </div>
              <div>
                <Label>{t("onboarding.nickname")}</Label>
                <Input placeholder={t("onboarding.nicknamePlaceholder")} value={nickname} onChange={e => setNickname(e.target.value)} className="bg-background/50 mt-1" />
              </div>
              <div>
                <Label>{t("onboarding.gender")}</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {genders.map(g => (
                    <button key={g.value} onClick={() => setGender(g.value)} className={cn("px-3 py-2 rounded-lg text-sm border transition-all", gender === g.value ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                      {{"male": t("onboarding.male"), "female": t("onboarding.female"), "non-binary": t("onboarding.nonBinary"), "prefer-not-to-say": t("onboarding.preferNotToSay")}[g.value] ?? g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("onboarding.dateOfBirth", "Date of Birth")}</Label>
                <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="bg-background/50 mt-1" max={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()).toISOString().split("T")[0]} />
                <p className="text-[10px] text-muted-foreground mt-1">{t("onboarding.ageRequirement", "You must be at least 18 years old")}</p>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <span className="text-5xl">📊</span>
              <h2 className="text-2xl font-bold">{t("onboarding.skillLevelTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.skillLevelDesc")}</p>
            </div>
            <div>
              <Label>{t("onboarding.skillLevel")}</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {skillLevels.map(s => (
                  <button key={s} onClick={() => setSkill(s)} className={cn("px-3 py-3 rounded-lg text-sm font-medium border transition-all", skill === s ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("onboarding.handedness")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {handOptions.map(h => (
                  <button key={h} onClick={() => setHand(h)} className={cn("px-3 py-3 rounded-lg text-sm font-medium border transition-all", hand === h ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Left": t("onboarding.left"), "Right": t("onboarding.right"), "Ambidextrous": t("onboarding.ambidextrous")}[h] ?? h}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <span className="text-5xl">🎯</span>
              <h2 className="text-2xl font-bold">{t("onboarding.playStyleTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.playStyleDesc")}</p>
            </div>
            <div>
              <Label>{t("onboarding.vibe")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {vibes.map(v => (
                  <button key={v} onClick={() => setVibe(v)} className={cn("px-3 py-3 rounded-lg text-sm font-medium border transition-all", vibe === v ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {v === "Social" ? t("onboarding.social") : v === "Competitive" ? t("onboarding.competitive") : t("onboarding.both")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("onboarding.pace")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {paces.map(p => (
                  <button key={p} onClick={() => setPace(p)} className={cn("px-2 py-3 rounded-lg text-xs font-medium border transition-all", pace === p ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Rally & Flow": t("onboarding.rallyFlow"), "Fast & Aggressive": t("onboarding.fastAggressive"), "Both": t("onboarding.both")}[p] ?? p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("onboarding.playStyleMultiple")}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {playStyles.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStyle(s)}
                    title={{
                      "Power Player": t("onboarding.powerPlayerDesc"),
                      "Kitchen Master": t("onboarding.kitchenMasterDesc"),
                      "Strategist": t("onboarding.strategistDesc"),
                      "Defender": t("onboarding.defenderDesc"),
                      "All-Courter": t("onboarding.allCourterDesc"),
                      "Friendly": t("onboarding.friendlyDesc"),
                      "All of the above": t("onboarding.allOfAboveDesc"),
                    }[s] ?? s}
                    aria-label={`${{
                      "Power Player": t("onboarding.powerPlayer"),
                      "Kitchen Master": t("onboarding.kitchenMaster"),
                      "Strategist": t("onboarding.strategist"),
                      "Defender": t("onboarding.defender"),
                      "All-Courter": t("onboarding.allCourter"),
                      "Friendly": t("onboarding.friendly"),
                      "All of the above": t("onboarding.allOfAbove"),
                    }[s] ?? s}. ${{
                      "Power Player": t("onboarding.powerPlayerDesc"),
                      "Kitchen Master": t("onboarding.kitchenMasterDesc"),
                      "Strategist": t("onboarding.strategistDesc"),
                      "Defender": t("onboarding.defenderDesc"),
                      "All-Courter": t("onboarding.allCourterDesc"),
                      "Friendly": t("onboarding.friendlyDesc"),
                      "All of the above": t("onboarding.allOfAboveDesc"),
                    }[s] ?? ""}`}
                    className={cn("group relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all", (s === allPlayStylesOption ? allPlayStylesSelected : styles.includes(s)) ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}
                  >
                    <span>{{"Power Player": t("onboarding.powerPlayer"), "Kitchen Master": t("onboarding.kitchenMaster"), "Strategist": t("onboarding.strategist"), "Defender": t("onboarding.defender"), "All-Courter": t("onboarding.allCourter"), "Friendly": t("onboarding.friendly"), "All of the above": t("onboarding.allOfAbove")}[s] ?? s}</span>
                    <Info size={11} aria-hidden="true" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2 text-left text-[11px] leading-snug text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {{"Power Player": t("onboarding.powerPlayerDesc"), "Kitchen Master": t("onboarding.kitchenMasterDesc"), "Strategist": t("onboarding.strategistDesc"), "Defender": t("onboarding.defenderDesc"), "All-Courter": t("onboarding.allCourterDesc"), "Friendly": t("onboarding.friendlyDesc"), "All of the above": t("onboarding.allOfAboveDesc")}[s] ?? s}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <span className="text-5xl">📅</span>
              <h2 className="text-2xl font-bold">{t("onboarding.goalsTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.goalsDesc")}</p>
            </div>
            <div>
              <Label>{t("onboarding.goals")}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {goalOptions.map(g => (
                  <button key={g} onClick={() => toggleArray(goals, g, setGoals)} className={cn("px-3 py-2 rounded-full text-xs font-medium border transition-all", goals.includes(g) ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Recreation": t("onboarding.recreation"), "Tournaments": t("onboarding.tournaments"), "Skill Improvement": t("onboarding.skillImprovement"), "Fitness": t("onboarding.fitness"), "Social": t("onboarding.socialGoal"), "Learn": t("onboarding.learn"), "Leagues": t("onboarding.leagues"), "Other": t("onboarding.otherGoal")}[g] ?? g}
                  </button>
                ))}
              </div>
              {goals.includes("Other") && (
                <Input
                  value={otherGoal}
                  onChange={e => setOtherGoal(e.target.value)}
                  placeholder={t("onboarding.otherGoalPlaceholder")}
                  className="bg-background/50 mt-2"
                  maxLength={120}
                />
              )}
            </div>
            <div>
              <Label>{t("onboarding.availabilityLabel")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availabilities.map(a => (
                  <button key={a} onClick={() => toggleAvailability(a)} className={cn("px-2 py-2 rounded-lg text-xs font-medium border transition-all", avail.includes(a) ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Any": t("onboarding.anyAvailability"), "Weekday Mornings": t("onboarding.weekdayMornings"), "Weekday Afternoons": t("onboarding.weekdayAfternoons"), "Weekday Evenings": t("onboarding.weekdayEvenings"), "Weekend Mornings": t("onboarding.weekendMornings"), "Weekend Afternoons": t("onboarding.weekendAfternoons"), "Weekend Evenings": t("onboarding.weekendEvenings"), "Specific date(s)": t("onboarding.specificDates")}[a] ?? a}
                  </button>
                ))}
              </div>
              {avail.includes("Specific date(s)") && (
                <Input
                  value={specificDates}
                  onChange={e => setSpecificDates(e.target.value)}
                  placeholder={t("onboarding.specificDatesPlaceholder")}
                  className="bg-background/50 mt-2"
                  maxLength={120}
                />
              )}
            </div>
            <div>
              <Label>{t("onboarding.courtPreference")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {courtPrefs.map(c => (
                  <button key={c} onClick={() => setCourtPref(c)} className={cn("px-3 py-3 rounded-lg text-sm font-medium border transition-all", courtPref === c ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Indoor": t("onboarding.indoor"), "Outdoor": t("onboarding.outdoor"), "Both": t("onboarding.both")}[c] ?? c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("onboarding.courtAccess")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {courtAccessPrefs.map(c => (
                  <button key={c} onClick={() => setCourtAccess(c)} className={cn("px-3 py-3 rounded-lg text-sm font-medium border transition-all", courtAccess === c ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}>
                    {{"Public": t("onboarding.publicAccess"), "Private": t("onboarding.privateAccess"), "Any": t("onboarding.anyAccess")}[c] ?? c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center space-y-2 mb-6">
              <span className="text-5xl">📸</span>
              <h2 className="text-2xl font-bold">{t("onboarding.photosTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.photosDesc")}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {displayedPhotos.map((url, i) => (
                <div key={url} className="relative aspect-[3/4] rounded-xl overflow-hidden group">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-secondary/90 text-[8px] font-bold text-black uppercase">{t("onboarding.main")}</div>
                  )}
                  <button
                    onClick={() => url === selectedAvatar ? setSelectedAvatar("") : setUploadedPhotos(prev => prev.filter(photoUrl => photoUrl !== url))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
              {displayedPhotos.length < 6 && (
                <button
                  onClick={openFilePicker}
                  disabled={uploading}
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                >
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {displayedPhotos.length === 0 ? <Camera size={20} className="text-muted-foreground" /> : <Plus size={20} className="text-muted-foreground" />}
                      <span className="text-[10px] text-muted-foreground font-medium">{t("onboarding.addPhoto")}</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("onboarding.avatarPresetLabel")}</Label>
              <div className="grid grid-cols-4 gap-2">
                {presetAvatars.map(avatar => {
                  const label = t(avatar.labelKey);
                  return (
                    <button
                      key={avatar.url}
                      type="button"
                      onClick={() => setSelectedAvatar(selectedAvatar === avatar.url ? "" : avatar.url)}
                      title={label}
                      aria-label={label}
                      className={cn("aspect-square rounded-full border-2 overflow-hidden bg-background/40 transition-all", selectedAvatar === avatar.url ? "border-secondary shadow-[0_0_0_3px_rgba(191,255,0,0.18)]" : "border-border hover:border-muted-foreground")}
                    >
                      <img src={avatar.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{t("onboarding.avatarPresetDesc")}</p>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {displayedPhotos.length === 0 ? t("onboarding.photoOptional") : t("onboarding.photosAdded", { count: displayedPhotos.length })}
            </p>
            {cropSrc && (
              <ImageCropper
                imageSrc={cropSrc}
                onCropComplete={handleCropComplete}
                onCancel={handleCropCancel}
                aspect={3 / 4}
                circular={false}
              />
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 text-center">
            <span className="text-6xl block">🎉</span>
            <h2 className="text-2xl font-bold">{t("onboarding.allSetTitle")}</h2>
            <p className="text-muted-foreground">{t("onboarding.allSetDesc")}</p>
            {displayedPhotos.length > 0 && (
              <div className="flex justify-center gap-2">
                {displayedPhotos.slice(0, 3).map((url, i) => (
                  <div key={url} className="w-16 h-20 rounded-xl overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {displayedPhotos.length > 3 && (
                  <div className="w-16 h-20 rounded-xl bg-muted/20 flex items-center justify-center text-sm text-muted-foreground font-bold">
                    +{displayedPhotos.length - 3}
                  </div>
                )}
              </div>
            )}
            <div className="card-elevated rounded-xl p-4 text-left space-y-2 text-sm">
              <p><span className="text-muted-foreground">{t("onboarding.summaryName")}</span> <span className="text-foreground font-medium">{nickname || fullName || "—"}</span></p>
              <p><span className="text-muted-foreground">{t("onboarding.summarySkill")}</span> <span className="text-foreground font-medium">{skill || "—"}</span></p>
              <p><span className="text-muted-foreground">{t("onboarding.summaryVibe")}</span> <span className="text-foreground font-medium">{vibe || "—"}</span></p>
              {pace && <p><span className="text-muted-foreground">{t("onboarding.summaryPace")}</span> <span className="text-foreground font-medium">{pace}</span></p>}
              {styles.length > 0 && <p><span className="text-muted-foreground">{t("onboarding.summaryStyles")}</span> <span className="text-foreground font-medium">{styles.join(", ")}</span></p>}
              <p><span className="text-muted-foreground">{t("onboarding.summaryGoals")}</span> <span className="text-foreground font-medium">{buildGoalsSummary() || "—"}</span></p>
              <p><span className="text-muted-foreground">{t("onboarding.summaryAvailability")}</span> <span className="text-foreground font-medium">{buildAvailabilitySummary() || "—"}</span></p>
              {courtPref && <p><span className="text-muted-foreground">{t("onboarding.summaryCourt")}</span> <span className="text-foreground font-medium">{courtPref}</span></p>}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden px-6 py-8 safe-area-top safe-area-bottom">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/30 blur-[120px] -top-40 -right-20" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px] -bottom-40 -left-20" />

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col flex-1">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / totalSteps) * 100} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="flex-1">{renderStep()}</div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 gap-1">
              <ChevronLeft size={16} /> {t("onboarding.back")}
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button onClick={() => {
              if (step === 0 && !fullName.trim() && !nickname.trim()) {
                toast.error(t("onboarding.enterNameError"));
                return;
              }
              if (step === 0 && !gender) {
                toast.error(t("onboarding.selectGenderError", "Please select your gender"));
                return;
              }
              if (step === 0 && !dateOfBirth) {
                toast.error(t("onboarding.dobRequired", "Please enter your date of birth"));
                return;
              }
              if (step === 0 && dateOfBirth) {
                const dob = new Date(dateOfBirth);
                const ageDiff = Date.now() - dob.getTime();
                const ageDate = new Date(ageDiff);
                const age = Math.abs(ageDate.getUTCFullYear() - 1970);
                if (age < 18) {
                  toast.error(t("onboarding.under18", "You must be at least 18 years old to use PKL Court Connect"));
                  return;
                }
              }
              if (step === 1 && !skill) {
                toast.error(t("onboarding.selectSkillError"));
                return;
              }
              if (step === 2 && !vibe) {
                toast.error(t("onboarding.selectVibeError"));
                return;
              }
              if (step === 3 && goals.length === 0) {
                toast.error(t("onboarding.selectGoalError"));
                return;
              }
              if (step === 3 && goals.includes("Other") && !otherGoal.trim()) {
                toast.error(t("onboarding.otherGoalError"));
                return;
              }
              if (step === 3 && avail.length === 0) {
                toast.error(t("onboarding.selectAvailabilityError"));
                return;
              }
              if (step === 3 && avail.includes("Specific date(s)") && !specificDates.trim()) {
                toast.error(t("onboarding.specificDatesError"));
                return;
              }
              setStep(s => s + 1);
            }} className="flex-1 gap-1 bg-primary text-white">
              {t("onboarding.next")} <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleFinish} className="flex-1 gap-1 bg-secondary text-secondary-foreground font-semibold">
              <Check size={16} /> {t("onboarding.letsGo")}
            </Button>
          )}
        </div>


      </div>
    </div>
  );
}
