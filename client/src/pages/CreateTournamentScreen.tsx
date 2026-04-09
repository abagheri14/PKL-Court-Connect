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
      toast.success("Tournament created!");
      utils.tournaments.list.invalidate();
      utils.tournaments.myTournaments.invalidate();
      navigate("tournaments");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Tournament name is required");
    if (!startDate) return toast.error("Start date is required");
    if (endDate && new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");
    if (registrationDeadline && new Date(registrationDeadline) >= new Date(startDate)) return toast.error("Registration deadline must be before start date");
    if (skillLevelMin && skillLevelMax && parseFloat(skillLevelMin) > parseFloat(skillLevelMax)) return toast.error("Min skill level cannot exceed max");
    if (bestOf % 2 === 0) return toast.error("Best of must be an odd number");
    if (format === "round-robin" && maxParticipants > 16) return toast.error("Round-robin supports max 16 participants");
    if (entryFee && parseFloat(entryFee) < 0) return toast.error("Entry fee cannot be negative");

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
          <button onClick={goBack} aria-label="Go back" className="p-1 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFC107]" />
            <h1 className="text-lg font-bold">Create Tournament</h1>
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
              <h2 className="text-lg font-semibold mb-1">Basic Info</h2>
              <p className="text-sm text-muted-foreground">Set up the essentials for your tournament</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tournament Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend Shootout" maxLength={100} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell players what this tournament is about..."
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tournament Format *</label>
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
              <label className="text-sm font-medium">Game Format *</label>
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
              <label className="text-sm font-medium">Max Participants</label>
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
              Next: Schedule & Location
            </Button>
          </div>
        )}

        {/* Step 2: Schedule & Location */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold mb-1">Schedule & Location</h2>
              <p className="text-sm text-muted-foreground">Set when and where the tournament happens</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date & Time *</label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date & Time</label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Registration Deadline</label>
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
                <label className="text-sm font-medium">Entry Fee ($)</label>
                <Input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prize</label>
                <Input value={prizeDescription} onChange={(e) => setPrizeDescription(e.target.value)} placeholder="Trophy + $100" maxLength={500} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!startDate}>Next: Rules & Settings</Button>
            </div>
          </div>
        )}

        {/* Step 3: Rules & Settings */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold mb-1">Rules & Settings</h2>
              <p className="text-sm text-muted-foreground">Fine-tune the game rules</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Points to Win</label>
                <Input type="number" value={pointsToWin} onChange={(e) => setPointsToWin(Number(e.target.value))} min={1} max={21} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Best Of</label>
                <Input type="number" value={bestOf} onChange={(e) => setBestOf(Number(e.target.value))} min={1} max={7} step={2} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Win By</label>
                <Input type="number" value={winBy} onChange={(e) => setWinBy(Number(e.target.value))} min={1} max={5} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Skill Level</label>
                <select
                  value={skillLevelMin}
                  onChange={(e) => setSkillLevelMin(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Any</option>
                  {SKILL_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Skill Level</label>
                <select
                  value={skillLevelMax}
                  onChange={(e) => setSkillLevelMax(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Any</option>
                  {SKILL_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tournament Rules</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Enter any special rules or notes for participants..."
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={5000}
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium">Public Tournament</span>
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
                <span className="text-sm font-medium">Require Approval to Join</span>
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
              <h3 className="font-semibold text-sm">Tournament Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>📝 {name || "Untitled"}</span>
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
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={handleSubmit} className="flex-1 gap-2 bg-[#FFC107] text-[#1a1d2e] hover:bg-[#e0a800]" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Create Tournament
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
