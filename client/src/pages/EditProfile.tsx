import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import ImageCropper from "@/components/ImageCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { ArrowLeft, Camera, Save, Loader2, Plus, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import PlayerAvatar from "@/components/PlayerAvatar";
import { toast } from "sonner";

const skillLevels = ["Beginner", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0+"];
const vibes = ["Social", "Competitive", "Both"] as const;
const playStyles = ["Power Player", "Kitchen Master", "Strategist", "Defender", "All-Courter"];
const MAX_PHOTOS = 6;

export default function EditProfile() {
  const { t } = useTranslation();
  const { user, navigate, goBack, refetchUser } = useApp();
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      refetchUser();
      toast.success(t("editProfile.profileUpdated"));
      navigate("profile");
    },
    onError: (err) => toast.error(err.message),
  });

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [showFullName, setShowFullName] = useState(user?.showFullName ?? true);
  const [skill, setSkill] = useState(user?.skillLevel ?? "3.0");
  const [vibe, setVibe] = useState<"Social" | "Competitive" | "Both">(() => {
    const v = user?.vibe;
    if (!v) return "Social";
    return (v.charAt(0).toUpperCase() + v.slice(1)) as "Social" | "Competitive" | "Both";
  });
  const [styles, setStyles] = useState<string[]>(() => {
    const ps = user?.playStyle;
    if (!ps) return [];
    if (Array.isArray(ps)) return ps;
    return String(ps).split(",").map(s => s.trim()).filter(Boolean);
  });

  // Multi-photo management
  const photosQuery = trpc.photos.list.useQuery();
  const photos: any[] = photosQuery.data ?? [];
  const addPhotoMutation = trpc.photos.add.useMutation({
    onSuccess: () => { photosQuery.refetch(); refetchUser(); },
    onError: (e) => toast.error(e.message),
  });
  const removePhotoMutation = trpc.photos.remove.useMutation({
    onSuccess: () => { photosQuery.refetch(); refetchUser(); },
    onError: (e) => toast.error(e.message),
  });
  const setPrimaryMutation = trpc.photos.setPrimary.useMutation({
    onSuccess: () => { photosQuery.refetch(); refetchUser(); },
    onError: (e) => toast.error(e.message),
  });

  const { uploading, openFilePicker, cropSrc, handleCropComplete, handleCropCancel } = usePhotoUpload({
    purpose: "profile-photo",
    enableCrop: true,
    onSuccess: (url) => {
      addPhotoMutation.mutate({ photoUrl: url });
    },
  });

  const toggleStyle = (s: string) => {
    setStyles(styles.includes(s) ? styles.filter(x => x !== s) : [...styles, s]);
  };

  const handleSave = () => {
    updateProfileMutation.mutate({
      name: fullName,
      nickname,
      bio,
      showFullName,
      skillLevel: skill,
      vibe: vibe.toLowerCase() as "social" | "competitive" | "both",
      playStyle: styles.join(", "),
    });
  };

  return (
    <>
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspect={1}
          circular={false}
        />
      )}
    <div className="pb-24 min-h-screen">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => goBack()} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold flex-1">{t("editProfile.title")}</h1>
        <Button onClick={handleSave} size="sm" className="bg-gradient-to-r from-primary to-accent text-white gap-1.5 shadow-[0_0_16px_rgba(168,85,247,0.15)]">
          <Save size={14} /> {t("editProfile.save")}
        </Button>
      </div>

      {/* Photo Grid (Tinder-style) */}
      <div className="px-4 py-3">
        <Label className="text-sm font-bold mb-2 block">{t("editProfile.photos", { count: photos.length, max: MAX_PHOTOS })}</Label>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
            const photo = photos[i];
            if (photo) {
              return (
                <div key={photo.id} className="relative aspect-[3/4] rounded-xl overflow-hidden group">
                  <img src={photo.photoUrl} alt="" className="w-full h-full object-cover" />
                  {/* Primary badge */}
                  {photo.isPrimary && (
                    <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-primary to-accent rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                      <Star size={9} className="text-white fill-white" />
                      <span className="text-[8px] text-white font-bold">{t("editProfile.main")}</span>
                    </div>
                  )}
                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!photo.isPrimary && (
                      <button
                        onClick={() => setPrimaryMutation.mutate({ photoId: photo.id })}
                        className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                        title="Set as primary"
                      >
                        <Star size={14} className="text-white" />
                      </button>
                    )}
                    <button
                      onClick={() => removePhotoMutation.mutate({ photoId: photo.id })}
                      className="p-2 rounded-full bg-red-500/70 backdrop-blur-sm hover:bg-red-500/90 transition-colors"
                      title="Remove"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              );
            }
            // Empty slot
            return (
              <button
                key={`empty-${i}`}
                onClick={photos.length < MAX_PHOTOS ? openFilePicker : undefined}
                disabled={uploading || photos.length >= MAX_PHOTOS}
                className={cn(
                  "aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all",
                  i === photos.length
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
                    : "border-border/30 bg-muted/5 opacity-40"
                )}
              >
                {uploading && i === photos.length ? (
                  <Loader2 size={20} className="text-primary animate-spin" />
                ) : (
                  <>
                    <Plus size={20} className={i === photos.length ? "text-primary" : "text-muted-foreground/50"} />
                    {i === photos.length && <span className="text-[9px] text-primary font-medium">{t("editProfile.addPhoto")}</span>}
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {t("editProfile.photoTip", { max: MAX_PHOTOS })}
        </p>
      </div>

      <div className="px-4 space-y-5">
        {/* Name Fields */}
        <div className="space-y-3">
          <div>
            <Label>{t("editProfile.fullName")}</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-background/50 mt-1" />
          </div>
          <div>
            <Label>{t("editProfile.nickname")}</Label>
            <Input value={nickname} onChange={e => setNickname(e.target.value)} className="bg-background/50 mt-1" />
          </div>
          <div className="flex items-center justify-between card-elevated rounded-xl p-3">
            <div>
              <p className="text-sm font-medium">{t("editProfile.showFullName")}</p>
              <p className="text-xs text-muted-foreground">{t("editProfile.showFullNameDesc")}</p>
            </div>
            <Switch checked={showFullName} onCheckedChange={setShowFullName} />
          </div>
        </div>

        {/* Bio */}
        <div>
          <Label>{t("editProfile.bio")}</Label>
          <Textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="bg-background/50 mt-1 min-h-[80px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{bio.length}/500</p>
        </div>

        {/* Skill Level */}
        <div>
          <Label>{t("editProfile.skillLevel")}</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {skillLevels.map(s => (
              <button
                key={s}
                onClick={() => setSkill(s)}
                className={cn("px-3 py-2.5 rounded-lg text-sm font-medium border transition-all", skill === s ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Vibe */}
        <div>
          <Label>{t("editProfile.vibe")}</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {vibes.map(v => (
              <button
                key={v}
                onClick={() => setVibe(v)}
                className={cn("px-3 py-2.5 rounded-lg text-sm font-medium border transition-all", vibe === v ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Play Style */}
        <div>
          <Label>{t("editProfile.playStyle")}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {playStyles.map(s => (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                className={cn("px-3 py-2 rounded-full text-xs font-medium border transition-all", styles.includes(s) ? "border-accent bg-accent/20 text-accent" : "border-border bg-background/30 text-muted-foreground hover:border-muted-foreground")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
