import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";
import { formatTimeAgo, getDisplayName } from "@/lib/avatarUtils";
import {
  Activity, Trophy, Swords, Star, TrendingUp, Users, GraduationCap, Target, Flame,
  Loader2, Heart, MessageCircle, Send, Image, X, ChevronDown, Trash2, Newspaper,
  HelpCircle, Lightbulb, Megaphone, Filter, Bookmark, Share2, RefreshCw,
  Sparkles, Zap, MapPin, Camera,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect, type TouchEvent as ReactTouchEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/hooks/useGeolocation";

// ── Icons & Maps ──────────────────────────────────────────────────────────
const activityIcons: Record<string, any> = {
  achievement_earned: Trophy, game_completed: Swords, tournament_won: Trophy,
  court_reviewed: Star, level_up: TrendingUp, streak_milestone: Flame,
  new_match: Target, joined_group: Users, coaching_completed: GraduationCap, user_post: Newspaper,
};
const activityColors: Record<string, string> = {
  achievement_earned: "text-yellow-400", game_completed: "text-[#BFFF00]",
  tournament_won: "text-yellow-400", court_reviewed: "text-blue-400",
  level_up: "text-purple-400", streak_milestone: "text-orange-400",
  new_match: "text-pink-400", joined_group: "text-cyan-400",
  coaching_completed: "text-green-400", user_post: "text-[#BFFF00]",
};

const postTypeIcons: Record<string, any> = {
  general: Newspaper, highlight: Star, question: HelpCircle, tip: Lightbulb, looking_for_players: Megaphone,
};
const postTypeLabels: Record<string, string> = {
  general: "Post", highlight: "Highlight", question: "Question", tip: "Tip", looking_for_players: "LFP",
};
const postTypeEmoji: Record<string, string> = {
  general: "📝", highlight: "🔥", question: "💭", tip: "💡", looking_for_players: "🎯",
};

const vibeColors: Record<string, string> = {
  competitive: "from-red-500/20 to-orange-500/20 text-orange-400 border-orange-500/30",
  social: "from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30",
  both: "from-purple-500/20 to-pink-500/20 text-pink-400 border-pink-500/30",
};
const vibeEmoji: Record<string, string> = { competitive: "⚔️", social: "🎉", both: "🎭" };

const quickReactions = ["🔥", "👏", "😂", "🏓", "💪", "🎯"];

const filterOptions = [
  { value: "all", label: "All", icon: "✨" },
  { value: "general", label: "Posts", icon: "📝" },
  { value: "highlight", label: "Highlights", icon: "🔥" },
  { value: "question", label: "Questions", icon: "💭" },
  { value: "tip", label: "Tips", icon: "💡" },
  { value: "looking_for_players", label: "LFP", icon: "🎯" },
];

// ── Nearby Players Strip (Boo Discovery) ──────────────────────────────────
function NearbyStrip() {
  const { selectPlayer, navigate, user } = useApp();
  const { lat, lng } = useGeolocation({ fallbackLat: user?.latitude, fallbackLng: user?.longitude });
  const candidatesQuery = trpc.swipes.candidates.useQuery(
    { lat, lng, radiusMiles: 25 },
    { enabled: !!(lat && lng), staleTime: 120_000 }
  );
  const candidates: any[] = (candidatesQuery.data ?? []).slice(0, 12);

  if (candidates.length === 0) return null;

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold flex items-center gap-1.5">
          <Sparkles size={12} className="text-[#BFFF00]" /> Nearby Players
        </h3>
        <button onClick={() => navigate("swipe")} className="text-[10px] text-[#BFFF00] font-medium">
          See All →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
        {candidates.map((p: any) => (
          <button
            key={p.id}
            onClick={() => { selectPlayer(p.id); navigate("playerProfile"); }}
            className="flex-shrink-0 flex flex-col items-center gap-1 w-16"
          >
            <div className="relative">
              <div className="rounded-full p-[2px] bg-gradient-to-br from-[#BFFF00] to-green-500">
                <PlayerAvatar
                  user={{ id: p.id, name: p.name, profilePhotoUrl: p.profilePhotoUrl, hasProfilePhoto: !!p.profilePhotoUrl }}
                  size="sm"
                  showBadges={false}
                />
              </div>
              {p.distanceMiles != null && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] px-1.5 py-0.5 rounded-full bg-background border border-border/50 text-muted-foreground font-medium whitespace-nowrap">
                  {p.distanceMiles < 1 ? "<1mi" : `${Math.round(p.distanceMiles)}mi`}
                </span>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground font-medium truncate w-full text-center mt-0.5">
              {p.nickname || p.name?.split(" ")[0] || "Player"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Post Composer (Boo-style with photo upload) ───────────────────────────
function PostComposer({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useApp();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<string>("general");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const createPostMutation = trpc.feed.createPost.useMutation({
    onSuccess: () => {
      setContent("");
      setPostType("general");
      setPhotoUrl("");
      toast.success("Post shared! 🎉");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", "feed");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPhotoUrl(data.url);
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed && !photoUrl) return;
    createPostMutation.mutate({
      content: trimmed || (photoUrl ? "📸" : ""),
      postType: postType as any,
      photoUrl: photoUrl || undefined,
    });
  };

  const TypeIcon = postTypeIcons[postType] || Newspaper;

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/20 p-4">
      <div className="flex gap-3">
        <PlayerAvatar
          user={{ id: user?.id ?? 0, name: user?.name, profilePhotoUrl: user?.profilePhotoUrl, hasProfilePhoto: !!user?.profilePhotoUrl }}
          size="sm" showBadges={false}
        />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your court today? 🏓"
            className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40 min-h-[50px] max-h-[120px]"
            maxLength={2000}
            rows={2}
          />

          {/* Photo preview */}
          {photoUrl && (
            <div className="relative mt-2 rounded-xl overflow-hidden">
              <img src={photoUrl} alt="" className="w-full max-h-[200px] object-cover rounded-xl" />
              <button onClick={() => setPhotoUrl("")} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/10">
            <div className="flex items-center gap-1.5">
              {/* Photo button */}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 rounded-full bg-muted/30 hover:bg-muted/50 text-muted-foreground transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

              {/* Post type selector */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeSelector(!showTypeSelector)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-muted/30 hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <span>{postTypeEmoji[postType]}</span>
                  {postTypeLabels[postType]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTypeSelector && (
                  <div className="absolute top-full left-0 mt-1 bg-background border border-border/50 rounded-xl shadow-xl z-30 py-1 min-w-[160px]">
                    {Object.entries(postTypeLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setPostType(key); setShowTypeSelector(false); }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-muted/30 transition-colors",
                          postType === key && "text-[#BFFF00] bg-[#BFFF00]/5"
                        )}
                      >
                        <span>{postTypeEmoji[key]}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[9px] text-muted-foreground/40">{content.length}/2000</span>
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={(!content.trim() && !photoUrl) || createPostMutation.isPending}
              className="h-7 px-4 text-xs bg-[#BFFF00] text-black hover:bg-[#BFFF00]/80 font-bold rounded-full"
            >
              {createPostMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span className="ml-1">Post</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comment Section ───────────────────────────────────────────────────────
function CommentSection({ postId }: { postId: number }) {
  const { user } = useApp();
  const [newComment, setNewComment] = useState("");
  const commentsQuery = trpc.feed.getComments.useQuery({ postId, limit: 50 });
  const addCommentMutation = trpc.feed.addComment.useMutation({
    onSuccess: () => { setNewComment(""); commentsQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addCommentMutation.mutate({ postId, content: trimmed });
  };

  const comments = commentsQuery.data ?? [];

  return (
    <div className="mt-3 pt-3 border-t border-border/10">
      {commentsQuery.isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" /></div>
      ) : comments.length > 0 ? (
        <div className="space-y-2.5 mb-3 max-h-[240px] overflow-y-auto">
          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <PlayerAvatar user={{ id: c.userId, name: c.userName, profilePhotoUrl: c.userPhoto, hasProfilePhoto: !!c.userPhoto }} size="xs" showBadges={false} />
              <div className="flex-1 min-w-0 bg-muted/15 rounded-xl px-3 py-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-[#BFFF00]">{c.userNickname || c.userName || "Player"}</span>
                  <span className="text-[9px] text-muted-foreground">{formatTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <PlayerAvatar user={{ id: user?.id ?? 0, name: user?.name, profilePhotoUrl: user?.profilePhotoUrl, hasProfilePhoto: !!user?.profilePhotoUrl }} size="xs" showBadges={false} />
        <div className="flex-1 flex items-center gap-1 bg-muted/15 rounded-full px-3 py-1.5">
          <input
            type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Reply..." className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40" maxLength={1000}
          />
          <button onClick={handleSubmit} disabled={!newComment.trim() || addCommentMutation.isPending} className="text-[#BFFF00] disabled:opacity-30">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Loading Card ─────────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div className="card-elevated mx-4 rounded-2xl overflow-hidden animate-pulse">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/30" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded-full bg-muted/30" />
            <div className="h-2 w-16 rounded-full bg-muted/20" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded-full bg-muted/20" />
          <div className="h-3 w-3/4 rounded-full bg-muted/20" />
        </div>
        <div className="mt-3 h-48 rounded-2xl bg-muted/15" />
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/10">
          <div className="h-7 w-16 rounded-full bg-muted/20" />
          <div className="h-7 w-16 rounded-full bg-muted/20" />
          <div className="h-7 w-8 rounded-full bg-muted/20" />
        </div>
      </div>
    </div>
  );
}

// ── Feed Post Card (Boo-style) ────────────────────────────────────────────
function FeedPostCard({ post, onLikeToggle, onDelete, onRefresh }: {
  post: any; onLikeToggle: (postId: number) => void; onDelete?: (postId: number) => void; onRefresh?: () => void;
}) {
  const { user, navigate, selectPlayer } = useApp();
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastTapRef = useRef(0);
  const isOwn = post.userId === user?.id;

  const toggleBookmarkMutation = trpc.feed.toggleBookmark.useMutation({
    onSuccess: (data) => {
      toast(data.bookmarked ? "Saved! 🔖" : "Removed from saved");
      onRefresh?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleReactionMutation = trpc.feed.toggleReaction.useMutation({
    onSuccess: () => { setShowReactions(false); onRefresh?.(); },
    onError: (err) => toast.error(err.message),
  });

  const reportPostMutation = trpc.feed.reportPost.useMutation({
    onSuccess: () => { toast.success("Post reported. We'll review it."); setShowReportDialog(false); setReportReason(""); },
    onError: (err) => toast.error(err.message),
  });

  const handleProfileTap = () => {
    if (post.userId !== user?.id) { selectPlayer(post.userId); navigate("playerProfile"); }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLiked) onLikeToggle(post.id);
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
    lastTapRef.current = now;
  };

  const handleShare = async () => {
    const shareText = `${post.userNickname || post.userName || "A player"}: ${post.content.slice(0, 140)}`;
    if (navigator.share) {
      try { await navigator.share({ title: "PKL Court Connect", text: shareText }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(shareText); toast.success("Copied to clipboard!"); } catch { toast.error("Share not available"); }
    }
  };

  const vibeTag = post.postType === "highlight" ? "🔥 Hot Take"
    : post.postType === "question" ? "💭 Curious"
    : post.postType === "tip" ? "💡 Pro Tip"
    : post.postType === "looking_for_players" ? "🎯 Rally Up"
    : null;

  const userVibe = post.userSkillLevel;
  const myReactions: string[] = post.myReactions || [];
  const reactionCounts: Record<string, number> = post.reactions || {};
  const totalReactions = Object.values(reactionCounts).reduce((a: number, b: any) => a + (b as number), 0);

  return (
    <>
      <div className="card-elevated mx-4 rounded-2xl overflow-hidden">
        {/* Accent bar */}
        {post.postType !== "general" && (
          <div className={cn("h-1",
            post.postType === "highlight" ? "bg-gradient-to-r from-orange-400 via-red-400 to-pink-500" :
            post.postType === "question" ? "bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500" :
            post.postType === "tip" ? "bg-gradient-to-r from-[#BFFF00] via-green-400 to-emerald-500" :
            "bg-gradient-to-r from-primary via-accent to-pink-500"
          )} />
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button onClick={handleProfileTap} className="relative flex-shrink-0">
              <PlayerAvatar
                user={{ id: post.userId, name: post.userName, profilePhotoUrl: post.userPhoto, hasProfilePhoto: !!post.userPhoto }}
                size="sm" showBadges={false}
              />
              {post.userLevel && (
                <span className="absolute -bottom-1 -right-1 text-[7px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#BFFF00] to-green-500 text-black font-black leading-none">
                  {post.userLevel}
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={handleProfileTap} className="text-sm font-bold hover:text-[#BFFF00] transition-colors truncate">
                  {post.userNickname || post.userName || "Player"}
                </button>
                {userVibe && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/30 text-muted-foreground font-medium capitalize">
                    {userVibe}
                  </span>
                )}
                {vibeTag && (
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-semibold border",
                    post.postType === "highlight" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                    post.postType === "question" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    post.postType === "tip" ? "bg-[#BFFF00]/10 text-[#BFFF00] border-[#BFFF00]/20" :
                    "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {vibeTag}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
            </div>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute top-full right-0 mt-1 bg-background border border-border/50 rounded-xl shadow-xl z-30 py-1 min-w-[140px]">
                  <button onClick={() => { handleShare(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-muted/30 transition-colors">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                  {isOwn && onDelete && (
                    <button onClick={() => { onDelete(post.id); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                  {!isOwn && (
                    <button onClick={() => { setShowReportDialog(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-orange-400 hover:bg-orange-500/10 transition-colors">
                      <Filter className="w-3.5 h-3.5" /> Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <p className={cn(
            "mt-3 whitespace-pre-wrap break-words leading-relaxed",
            post.content.length < 80 ? "text-lg font-semibold text-foreground" :
            post.content.length < 200 ? "text-base text-foreground" :
            "text-sm text-foreground/90"
          )}>{post.content}</p>

          {/* Photo (tap to expand, double-tap to like) */}
          {post.photoUrl && (
            <div className="relative mt-3 rounded-2xl overflow-hidden" onClick={handleDoubleTap}>
              <img src={post.photoUrl} alt="" className="w-full max-h-[320px] object-cover rounded-2xl cursor-pointer" />
              {showHeartAnim && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Heart className="w-20 h-20 text-pink-500 fill-pink-500 animate-[heartPop_0.8s_ease-out_forwards] drop-shadow-lg" />
                </div>
              )}
            </div>
          )}

          {/* Reaction summary */}
          {totalReactions > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex -space-x-0.5">
                {Object.entries(reactionCounts).slice(0, 5).map(([emoji]) => (
                  <span key={emoji} className="text-xs">{emoji}</span>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground ml-1">{totalReactions}</span>
            </div>
          )}

          {/* Quick reactions bar */}
          {showReactions && (
            <div className="flex items-center gap-1 mt-2 p-1.5 rounded-full bg-muted/20 w-fit animate-slide-up">
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji })}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-base transition-transform hover:scale-125 active:scale-90",
                    myReactions.includes(emoji) ? "bg-[#BFFF00]/20 ring-1 ring-[#BFFF00]/40" : "hover:bg-muted/40"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Engagement bar */}
          <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/10">
            <button
              onClick={() => onLikeToggle(post.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                post.isLiked ? "bg-pink-500/15 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.1)]" : "bg-muted/15 text-muted-foreground/60 hover:bg-pink-500/10 hover:text-pink-400"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5 transition-transform", post.isLiked && "fill-pink-400 scale-110")} />
              {post.likesCount > 0 && <span>{post.likesCount}</span>}
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                showComments ? "bg-[#BFFF00]/15 text-[#BFFF00]" : "bg-muted/15 text-muted-foreground/60 hover:bg-[#BFFF00]/10 hover:text-[#BFFF00]"
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
            </button>

            <button
              onClick={() => setShowReactions(!showReactions)}
              className="px-2.5 py-1.5 rounded-full text-xs bg-muted/15 text-muted-foreground/60 hover:bg-muted/30 transition-colors"
            >
              🔥
            </button>

            <div className="flex-1" />

            <button
              onClick={() => toggleBookmarkMutation.mutate({ postId: post.id })}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                post.isBookmarked ? "text-[#BFFF00]" : "text-muted-foreground/40 hover:text-muted-foreground/60"
              )}
            >
              <Bookmark className={cn("w-3.5 h-3.5", post.isBookmarked && "fill-[#BFFF00]")} />
            </button>
          </div>

          {showComments && <CommentSection postId={post.id} />}
        </div>
      </div>

      {/* Full-screen image viewer */}
      {imageExpanded && post.photoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setImageExpanded(false)}>
          <button className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white" onClick={() => setImageExpanded(false)}>
            <X size={20} />
          </button>
          <img src={post.photoUrl} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Report dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowReportDialog(false)}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm border border-border/50" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Report Post</h3>
            <div className="space-y-2 mb-3">
              {["Spam or misleading", "Harassment or bullying", "Inappropriate content", "Other"].map((r) => (
                <button
                  key={r}
                  onClick={() => setReportReason(r)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors",
                    reportReason === r ? "border-[#BFFF00]/40 bg-[#BFFF00]/10 text-[#BFFF00]" : "border-border/30 hover:bg-muted/20"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowReportDialog(false)} className="flex-1 text-xs">Cancel</Button>
              <Button
                size="sm"
                onClick={() => reportPostMutation.mutate({ postId: post.id, reason: reportReason })}
                disabled={!reportReason || reportPostMutation.isPending}
                className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white"
              >
                {reportPostMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Activity Item Card ────────────────────────────────────────────────────
function ActivityItemCard({ item }: { item: any }) {
  const Icon = activityIcons[item.activityType] || Activity;
  const color = activityColors[item.activityType] || "text-muted-foreground";
  return (
    <div className="card-elevated mx-4 rounded-2xl px-4 py-3 flex gap-3 items-start">
      <div className={cn("mt-0.5 p-2 rounded-xl bg-muted/20", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          {item.userName && <span className="text-[11px] text-[#BFFF00] font-medium">{item.userNickname || item.userName}</span>}
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Feed Screen (Boo-style) ──────────────────────────────────────────
export default function ActivityFeedScreen() {
  const { user } = useApp();
  const [tab, setTab] = useState<"posts" | "trending" | "saved" | "activity" | "my">("posts");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const PAGE_SIZE = 30;

  const postsQuery = trpc.feed.posts.useQuery(
    { limit: PAGE_SIZE, offset, filter: filter === "all" ? undefined : filter },
    { enabled: tab === "posts" || tab === "trending" }
  );

  // Accumulate posts for infinite scroll
  useEffect(() => {
    if (postsQuery.data) {
      const data = postsQuery.data as any[];
      if (offset === 0) { setAllPosts(data); } else { setAllPosts(prev => [...prev, ...data]); }
      setHasMore(data.length >= PAGE_SIZE);
    }
  }, [postsQuery.data, offset]);
  const savedQuery = trpc.feed.bookmarks.useQuery({ limit: 50 }, { enabled: tab === "saved" });
  const communityQuery = trpc.feed.list.useQuery({ limit: 50 }, { enabled: tab === "activity" });
  const myQuery = trpc.feed.my.useQuery({ limit: 50 }, { enabled: tab === "my" });

  const toggleLikeMutation = trpc.feed.toggleLike.useMutation({
    onSuccess: () => { postsQuery.refetch(); savedQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deletePostMutation = trpc.feed.deletePost.useMutation({
    onSuccess: () => { postsQuery.refetch(); toast.success("Post deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const handleLikeToggle = useCallback((postId: number) => { toggleLikeMutation.mutate({ postId }); }, []);
  const handleDeletePost = useCallback((postId: number) => { deletePostMutation.mutate({ postId }); }, []);
  const handleRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    await Promise.all([postsQuery.refetch(), savedQuery.refetch(), communityQuery.refetch(), myQuery.refetch()]);
    setRefreshing(false);
    toast.success("Feed refreshed!");
  };
  const handleRefetchPosts = useCallback(() => { postsQuery.refetch(); savedQuery.refetch(); }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !postsQuery.isFetching) { setOffset(prev => prev + PAGE_SIZE); }
  }, [hasMore, postsQuery.isFetching]);

  // IntersectionObserver for true infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !postsQuery.isFetching) { loadMore(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, postsQuery.isFetching, loadMore]);

  // Pull-to-refresh handlers
  const handlePullStart = useCallback((e: ReactTouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);
  const handlePullMove = useCallback((e: ReactTouchEvent) => {
    if (pullStartY.current === null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0 && dy < 150) setPullDistance(dy);
  }, []);
  const handlePullEnd = useCallback(() => {
    if (pullDistance > 60) handleRefresh();
    setPullDistance(0);
    pullStartY.current = null;
  }, [pullDistance, handleRefresh]);

  // Reset offset when filter or tab changes
  const handleFilterChange = (v: string) => { setFilter(v); setOffset(0); setAllPosts([]); };
  const handleTabChange = (t: typeof tab) => { setTab(t); setOffset(0); setAllPosts([]); };

  const trendingPosts = [...allPosts].sort((a, b) => (b.likesCount + b.commentsCount * 2) - (a.likesCount + a.commentsCount * 2));
  const posts = tab === "trending" ? trendingPosts : allPosts;
  const savedPosts: any[] = savedQuery.data ?? [];
  const activityItems: any[] = tab === "activity" ? (communityQuery.data ?? []) : (myQuery.data ?? []);
  const isLoading = (tab === "posts" || tab === "trending") ? postsQuery.isLoading && offset === 0
    : tab === "saved" ? savedQuery.isLoading
    : tab === "activity" ? communityQuery.isLoading : myQuery.isLoading;

  const tabs = [
    { key: "posts" as const, label: "Feed", icon: "✨" },
    { key: "trending" as const, label: "Hot", icon: "🔥" },
    { key: "saved" as const, label: "Saved", icon: "🔖" },
    { key: "activity" as const, label: "Activity", icon: "⚡" },
    { key: "my" as const, label: "Mine", icon: "👤" },
  ];

  return (
    <div ref={scrollContainerRef} className="min-h-screen bg-background pb-24 overflow-y-auto" onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd}>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex justify-center transition-all" style={{ height: pullDistance * 0.5, opacity: Math.min(pullDistance / 60, 1) }}>
          <RefreshCw className={cn("w-5 h-5 text-[#BFFF00] transition-transform", pullDistance > 60 && "animate-spin")} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#BFFF00]/20 to-green-500/10 flex items-center justify-center">
                <Zap size={16} className="text-[#BFFF00]" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight">Feed</h1>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", refreshing && "animate-spin")} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={cn(
                  "flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1",
                  tab === t.key
                    ? "bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30 shadow-[0_0_12px_rgba(191,255,0,0.05)]"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                )}
              >
                <span className="text-[10px]">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Filter chips (posts + trending tabs) */}
          {(tab === "posts" || tab === "trending") && (
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-none pb-0.5">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange(opt.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all shrink-0 flex items-center gap-1",
                    filter === opt.value
                      ? "bg-[#BFFF00]/15 text-[#BFFF00] border border-[#BFFF00]/30"
                      : "bg-muted/15 text-muted-foreground/60 hover:bg-muted/30"
                  )}
                >
                  <span>{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nearby discovery strip */}
      {tab === "posts" && <NearbyStrip />}

      {/* Post composer */}
      {(tab === "posts" || tab === "trending") && <PostComposer onSuccess={() => { setOffset(0); postsQuery.refetch(); }} />}

      {/* Content */}
      <div className="py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </div>
        ) : (tab === "posts" || tab === "trending") ? (
          posts.length === 0 ? (
            <div className="text-center py-16 animate-slide-up">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#BFFF00]/10 to-green-500/5 flex items-center justify-center mx-auto mb-4">
                <Newspaper className="w-8 h-8 text-[#BFFF00]/40" />
              </div>
              <p className="text-sm font-semibold">No posts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to share something! 🏓</p>
            </div>
          ) : (
            <>
              {tab === "trending" && posts.length > 0 && (
                <div className="mx-4 p-3 rounded-2xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-bold text-orange-400">Trending in your community</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Posts sorted by engagement</p>
                </div>
              )}
              {posts.map((post: any, i: number) => (
                <div key={post.id} className="animate-feed-card-in" style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}>
                  <FeedPostCard post={post} onLikeToggle={handleLikeToggle} onDelete={handleDeletePost} onRefresh={handleRefetchPosts} />
                </div>
              ))}
              {/* Infinite scroll sentinel */}
              {hasMore && tab === "posts" && (
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {postsQuery.isFetching && <Loader2 className="w-5 h-5 animate-spin text-[#BFFF00]" />}
                </div>
              )}
            </>
          )
        ) : tab === "saved" ? (
          savedPosts.length === 0 ? (
            <div className="text-center py-16 animate-slide-up">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#BFFF00]/10 to-green-500/5 flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-[#BFFF00]/40" />
              </div>
              <p className="text-sm font-semibold">No saved posts</p>
              <p className="text-xs text-muted-foreground mt-1">Bookmark posts to see them here</p>
            </div>
          ) : (
            savedPosts.map((post: any) => (
              <FeedPostCard key={post.id} post={post} onLikeToggle={handleLikeToggle} onRefresh={handleRefetchPosts} />
            ))
          )
        ) : (
          activityItems.length === 0 ? (
            <div className="text-center py-16 animate-slide-up">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-sm font-semibold">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">Get playing to see activity here!</p>
            </div>
          ) : (
            activityItems.map((item: any) => <ActivityItemCard key={item.id} item={item} />)
          )
        )}
      </div>
    </div>
  );
}
