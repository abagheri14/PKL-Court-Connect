import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Loader2, Info, Calendar, MapPin, Users, DollarSign, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import LocationPickerSection, { type LocationData } from "@/components/LocationPickerSection";

const FORMATS = [
  { value: "single-elimination", label: "Single Elimination", icon: "🏆", desc: "Lose once and you're out" },
  { value: "double-elimination", label: "Double Elimination", icon: "🔄", desc: "Lose twice and you're out" },
  { value: "round-robin", label: "Round Robin", icon: "🔁", desc: "Everyone plays everyone" },
] as const;

const GAME_FORMATS = [
  { value: "singles", label: "Singles" },
  { value: "mens-doubles", label: "Men's Doubles" },
  { value: "womens-doubles", label: "Women's Doubles" },
  { value: "mixed-doubles", label: "Mixed Doubles" },
] as const;

const SKILL_LEVELS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0"];

export default function CreateTournamentScreen() {
  const { navigate, goBack } = useApp();
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"single-elimination" | "double-elimination" | "round-robin">("single-elimination");
  const [gameFormat, setGameFormat] = useState<"singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles">("singles");
  const [maxParticipants, setMaxParticipants] = useState(16);
  const [entryFee, setEntryFee] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [pointsToWin, setPointsToWin] = useState(11);
  const [bestOf, setBestOf] = useState(3);
  const [winBy, setWinBy] = useState(2);
  const [locationName, setLocationName] = useState("");
  const [locationData, setLocationData] = useState<LocationData>({});
  const [skillLevelMin, setSkillLevelMin] = useState("");
  const [skillLevelMax, setSkillLevelMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [rules, setRules] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [step, setStep] = useState(1);

  const utils = trpc.useUtils();
  const createMutation = trpc.tournaments.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("tournament.created"));
      utils.tournaments.list.invalidate();
      utils.tournaments.myTournaments.invalidate();
      navigate("tournaments");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast.error(t("tournament.error.nameRequired"));
    if (!startDate) return toast.error(t("tournament.error.startDateRequired"));
    if (endDate && new Date(endDate) <= new Date(startDate)) return toast.error(t("tournament.error.endDateAfterStart"));
    if (registrationDeadline && new Date(registrationDeadline) >= new Date(startDate)) return toast.error(t("tournament.error.regDeadlineBeforeStart"));
    if (skillLevelMin && skillLevelMax && parseFloat(skillLevelMin) > parseFloat(skillLevelMax)) return toast.error(t("tournament.error.minExceedsMax"));
    if (bestOf % 2 === 0) return toast.error(t("tournament.error.bestOfOdd"));
    if (format === "round-robin" && maxParticipants > 16) return toast.error(t("tournament.error.roundRobinMax"));
    if (entryFee && parseFloat(entryFee) < 0) return toast.error(t("tournament.error.negativeFee"));

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      format,
      gameFormat,
      maxParticipants,
      entryFee: entryFee ? parseFloat(entryFee) : undefined,
      prizeDescription: prizeDescription.trim() || undefined,
      pointsToWin,
      bestOf,
      winBy,
      courtId: locationData.courtId || undefined,
      locationLat: locationData.locationLat || undefined,
      locationLng: locationData.locationLng || undefined,
      locationName: locationData.locationName || locationName.trim() || undefined,
      skillLevelMin: skillLevelMin || undefined,
      skillLevelMax: skillLevelMax || undefined,
      startDate,
      endDate: endDate || undefined,
      registrationDeadline: registrationDeadline || undefined,
      rules: rules.trim() || undefined,
      isPublic,
      requiresApproval,
    });
  };

  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFC107]" />
            <h1 className="text-lg font-bold">{t("tournament.createTitle")}</h1>
          </div>
        </div>
        {/* Progress */}
        <div className="flex gap-1 mt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t("tournament.basicInfo")}</h2>
              <p className="text-sm text-muted-foreground">{t("tournament.basicInfoDesc")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.nameLabel")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tournament.namePlaceholder")} maxLength={100} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.descriptionLabel")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("tournament.descriptionPlaceholder")}
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.formatLabel")}</label>
              <div className="space-y-2">
                {FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      format === f.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                    )}
                  >
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.gameFormatLabel")}</label>
              <div className="grid grid-cols-2 gap-2">
                {GAME_FORMATS.map(gf => (
                  <button
                    key={gf.value}
                    onClick={() => setGameFormat(gf.value)}
                    className={cn(
                      "p-2.5 rounded-lg border text-sm font-medium transition-all",
                      gameFormat === gf.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                    )}
                  >
                    {gf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.maxParticipants")}</label>
              <div className="flex gap-2">
                {[4, 8, 16, 32, 64].map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxParticipants(n)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                      maxParticipants === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full" disabled={!name.trim()}>
              {t("tournament.nextSchedule")}
            </Button>
          </div>
        )}

        {/* Step 2: Schedule & Location */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t("tournament.scheduleLocation")}</h2>
              <p className="text-sm text-muted-foreground">{t("tournament.scheduleLocationDesc")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.startDateLabel")}</label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.endDateLabel")}</label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.regDeadlineLabel")}</label>
              <Input type="datetime-local" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} />
            </div>

            <LocationPickerSection
              value={locationData}
              onChange={setLocationData}
              label="Tournament Location"
              accentColor="#FFC107"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.entryFeeLabel")}</label>
                <Input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.prizeLabel")}</label>
                <Input value={prizeDescription} onChange={(e) => setPrizeDescription(e.target.value)} placeholder={t("tournament.prizePlaceholder")} maxLength={500} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{t("common.back")}</Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!startDate}>{t("tournament.nextRules")}</Button>
            </div>
          </div>
        )}

        {/* Step 3: Rules & Settings */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t("tournament.rulesSettings")}</h2>
              <p className="text-sm text-muted-foreground">{t("tournament.rulesSettingsDesc")}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.pointsToWin")}</label>
                <Input type="number" value={pointsToWin} onChange={(e) => setPointsToWin(Number(e.target.value))} min={1} max={21} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.bestOf")}</label>
                <Input type="number" value={bestOf} onChange={(e) => setBestOf(Number(e.target.value))} min={1} max={7} step={2} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.winBy")}</label>
                <Input type="number" value={winBy} onChange={(e) => setWinBy(Number(e.target.value))} min={1} max={5} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.minSkillLevel")}</label>
                <select
                  value={skillLevelMin}
                  onChange={(e) => setSkillLevelMin(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("common.any")}</option>
                  {SKILL_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("tournament.maxSkillLevel")}</label>
                <select
                  value={skillLevelMax}
                  onChange={(e) => setSkillLevelMax(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("common.any")}</option>
                  {SKILL_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("tournament.rulesLabel")}</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={t("tournament.rulesPlaceholder")}
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={5000}
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("tournament.publicToggle")}</span>
                <button
                  role="switch"
                  aria-checked={isPublic}
                  onClick={() => setIsPublic(!isPublic)}
                  className={cn("w-11 h-6 rounded-full transition-colors relative", isPublic ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", isPublic ? "left-5.5" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("tournament.requireApproval")}</span>
                <button
                  role="switch"
                  aria-checked={requiresApproval}
                  onClick={() => setRequiresApproval(!requiresApproval)}
                  className={cn("w-11 h-6 rounded-full transition-colors relative", requiresApproval ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", requiresApproval ? "left-5.5" : "left-0.5")} />
                </button>
              </label>
            </div>

            {/* Summary */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-sm">{t("tournament.summary")}</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>📝 {name || t("tournament.untitled")}</span>
                <span>{FORMATS.find(f => f.value === format)?.icon} {FORMATS.find(f => f.value === format)?.label}</span>
                <span>🏓 {GAME_FORMATS.find(gf => gf.value === gameFormat)?.label}</span>
                <span>👥 Up to {maxParticipants} players</span>
                <span>📊 First to {pointsToWin}, Best of {bestOf}</span>
                {(locationData.locationName || locationName) && <span>📍 {locationData.locationName || locationName}</span>}
                {entryFee && <span>💰 ${entryFee} entry</span>}
                {prizeDescription && <span>🏆 {prizeDescription}</span>}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{t("common.back")}</Button>
              <Button onClick={handleSubmit} className="flex-1 gap-2 bg-[#FFC107] text-[#1a1d2e] hover:bg-[#e0a800]" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {t("tournament.createButton")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
