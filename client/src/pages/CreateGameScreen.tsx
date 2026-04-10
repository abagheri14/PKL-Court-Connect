import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, MapPin, Clock, Users, Trophy, Dumbbell, Zap, CalendarDays, Globe, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import LocationPickerSection, { type LocationData } from "@/components/LocationPickerSection";
import InvitePickerModal from "@/components/InvitePickerModal";

const gameTypes = ["Casual", "Competitive", "Tournament", "Practice"] as const;
const formats = ["Singles", "Men's Doubles", "Women's Doubles", "Mixed Doubles"] as const;
const skillLevels = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.0+"];

const formatMap: Record<string, "singles" | "mens-doubles" | "womens-doubles" | "mixed-doubles"> = {
  "Singles": "singles",
  "Men's Doubles": "mens-doubles",
  "Women's Doubles": "womens-doubles",
  "Mixed Doubles": "mixed-doubles",
};

const gameTypeMap: Record<string, "casual" | "competitive" | "tournament" | "practice"> = {
  "Casual": "casual",
  "Competitive": "competitive",
  "Tournament": "tournament",
  "Practice": "practice",
};

export default function CreateGameScreen() {
  const { navigate, goBack, createGameGroupId, setCreateGameGroupId } = useApp();
  const { t, i18n } = useTranslation();
  const courtsQuery = trpc.courts.list.useQuery();
  const courts: any[] = courtsQuery.data ?? [];
  const [createdGameId, setCreatedGameId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [locationData, setLocationData] = useState<LocationData>({});
  const createGameMutation = trpc.games.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(t("createGame.gameCreated"));
      setCreateGameGroupId(null);
      if (data?.id) {
        setCreatedGameId(data.id);
        setShowInvite(true);
      } else {
        navigate("gameHistory");
      }
    },
    onError: (err) => toast.error(err.message),
  });
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    courtId: "" as string | number,
    locationName: "",
    date: "",
    time: "",
    duration: 90,
    gameType: "Casual" as typeof gameTypes[number],
    format: "Mixed Doubles" as typeof formats[number],
    maxPlayers: 4,
    skillMin: "3.0",
    skillMax: "4.5",
    notes: "",
    isOpen: true,
  });

  const selectedCourt = courts.find((c: any) => c.id === form.courtId);

  const handleCreate = () => {
    const scheduledDate = new Date(`${form.date}T${form.time}:00`);
    if (isNaN(scheduledDate.getTime())) {
      toast.error(t("createGame.cannotSchedulePast"));
      return;
    }
    if (scheduledDate < new Date()) {
      toast.error(t("createGame.cannotSchedulePast"));
      return;
    }
    createGameMutation.mutate({
      courtId: locationData.courtId || (typeof form.courtId === "number" ? form.courtId : undefined),
      locationLat: locationData.locationLat || undefined,
      locationLng: locationData.locationLng || undefined,
      locationName: locationData.locationName || selectedCourt?.name || form.locationName || undefined,
      scheduledAt: `${form.date}T${form.time}:00`,
      durationMinutes: form.duration,
      gameType: gameTypeMap[form.gameType] ?? "casual",
      format: formatMap[form.format] ?? "mixed-doubles",
      maxPlayers: form.maxPlayers,
      skillLevelMin: form.skillMin,
      skillLevelMax: form.skillMax,
      notes: form.notes || undefined,
      isOpen: form.isOpen,
      groupId: createGameGroupId ?? undefined,
    });
  };

  return (
    <div className="pb-24 min-h-screen">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="p-1 rounded-full hover:bg-muted/20">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{t("createGame.title")}</h1>
        <span className="ml-auto text-[10px] text-muted-foreground">{t("createGame.stepOf", { step })}</span>
      </div>

      {/* Progress Bar */}
      <div className="px-4 mb-4">
        <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {/* Step 1 - Location & Time */}
      {step === 1 && (
        <div className="px-4 space-y-4">
          <div className="card-elevated rounded-xl p-4">
            <LocationPickerSection
              value={locationData}
              onChange={(data) => {
                setLocationData(data);
                if (data.courtId) {
                  setForm({ ...form, courtId: data.courtId, locationName: data.locationName || "" });
                }
              }}
            />
          </div>

          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays size={14} className="text-secondary" /> {t("createGame.dateTime")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("createGame.date")}</label>
                <Input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="bg-background/50 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">{t("createGame.time")}</label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className="bg-background/50 text-xs"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted-foreground block mb-1">{t("createGame.duration")}</label>
              <div className="flex gap-2">
                {[60, 90, 120].map(d => (
                  <button
                    key={d}
                    onClick={() => setForm({ ...form, duration: d })}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-medium border transition-all",
                      form.duration === d
                        ? "border-secondary bg-secondary/20 text-secondary"
                        : "border-border bg-background/30 text-muted-foreground"
                    )}
                  >
                    {d}min
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={!form.courtId || !form.date || !form.time}
            className="w-full bg-gradient-to-r from-primary to-secondary font-semibold"
          >
            {t("createGame.nextGameDetails")}
          </Button>
        </div>
      )}

      {/* Step 2 - Game Details */}
      {step === 2 && (
        <div className="px-4 space-y-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap size={14} className="text-secondary" /> {t("createGame.gameType")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {gameTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, gameType: type })}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-medium border transition-all",
                    form.gameType === type
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {t(`gameTypes.${gameTypeMap[type]}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users size={14} className="text-secondary" /> {t("createGame.format")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {formats.map(f => (
                <button
                  key={f}
                  onClick={() => setForm({ ...form, format: f, maxPlayers: f === "Singles" ? 2 : 4 })}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-medium border transition-all",
                    form.format === f
                      ? "border-secondary bg-secondary/20 text-secondary"
                      : "border-border bg-background/30 text-muted-foreground"
                  )}
                >
                  {t(`gameFormats.${formatMap[f]}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy size={14} className="text-secondary" /> {t("createGame.skillRange")}
            </h3>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">{t("createGame.min")}</label>
                <div className="flex gap-1 flex-wrap">
                  {skillLevels.slice(0, 4).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, skillMin: s })}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-medium border",
                        form.skillMin === s ? "border-secondary bg-secondary/20 text-secondary" : "border-border text-muted-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-muted-foreground text-xs mt-4">{t("createGame.to")}</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">{t("createGame.max")}</label>
                <div className="flex gap-1 flex-wrap">
                  {skillLevels.slice(4).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, skillMax: s })}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-medium border",
                        form.skillMax === s ? "border-secondary bg-secondary/20 text-secondary" : "border-border text-muted-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe size={14} className="text-secondary" /> {t("createGame.visibility")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForm({ ...form, isOpen: true })}
                className={cn(
                  "py-3 rounded-xl text-xs font-medium border transition-all text-center",
                  form.isOpen
                    ? "border-secondary bg-secondary/20 text-secondary"
                    : "border-border bg-background/30 text-muted-foreground"
                )}
              >
                <Globe size={16} className="mx-auto mb-1" />
                {t("createGame.public")}
                <p className="text-[9px] opacity-70 mt-0.5">{t("createGame.publicDesc")}</p>
              </button>
              <button
                onClick={() => setForm({ ...form, isOpen: false })}
                className={cn(
                  "py-3 rounded-xl text-xs font-medium border transition-all text-center",
                  !form.isOpen
                    ? "border-secondary bg-secondary/20 text-secondary"
                    : "border-border bg-background/30 text-muted-foreground"
                )}
              >
                <Lock size={16} className="mx-auto mb-1" />
                {t("createGame.private")}
                <p className="text-[9px] opacity-70 mt-0.5">{t("createGame.privateDesc")}</p>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setStep(1)} variant="outline" className="flex-1">{t("createGame.back")}</Button>
            <Button onClick={() => setStep(3)} className="flex-1 bg-gradient-to-r from-primary to-secondary font-semibold">
              {t("createGame.nextReview")}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 - Review & Create */}
      {step === 3 && (
        <div className="px-4 space-y-4">
          <div className="card-elevated rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">{t("createGame.gameSummary")}</h3>

            <div className="space-y-3">
              <SummaryRow icon={<MapPin size={14} />} label={t("createGame.court")} value={selectedCourt?.name || form.locationName} />
              <SummaryRow icon={<CalendarDays size={14} />} label={t("createGame.date")} value={form.date ? new Date(form.date).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" }) : ""} />
              <SummaryRow icon={<Clock size={14} />} label={t("createGame.time")} value={`${form.time} · ${form.duration}min`} />
              <SummaryRow icon={<Zap size={14} />} label={t("createGame.type")} value={t(`gameTypes.${gameTypeMap[form.gameType]}`)} />
              <SummaryRow icon={<Users size={14} />} label={t("createGame.format")} value={`${t(`gameFormats.${formatMap[form.format]}`)} (${form.maxPlayers} max)`} />
              <SummaryRow icon={<Trophy size={14} />} label={t("createGame.skillRange")} value={`${form.skillMin} - ${form.skillMax}`} />
            </div>
          </div>

          <div className="card-elevated rounded-xl p-4">
            <label className="text-sm font-semibold block mb-2">{t("createGame.notesOptional")}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder={t("createGame.notesPlaceholder")}
              className="w-full bg-background/50 rounded-xl p-3 text-xs border border-border min-h-[80px] resize-none focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setStep(2)} variant="outline" className="flex-1">{t("createGame.back")}</Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-gradient-to-r from-primary to-secondary font-semibold"
            >
              <CalendarDays size={14} className="mr-2" />
              {t("createGame.createGame")}
            </Button>
          </div>
        </div>
      )}

      <InvitePickerModal
        open={showInvite}
        onClose={() => { setShowInvite(false); navigate("gameHistory"); }}
        targetType="game"
        targetId={createdGameId!}
        targetName={selectedCourt?.name || form.locationName || "your game"}
      />
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-secondary">{icon}</div>
      <div className="flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}