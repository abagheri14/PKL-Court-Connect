import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/avatarUtils";
import {
  Activity, Trophy, Swords, Star, TrendingUp, Users, GraduationCap, Target, Flame,
  Loader2, Heart, MessageCircle, Send, Image, X, ChevronDown, Trash2, Newspaper,
  HelpCircle, Lightbulb, Megaphone, Filter,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ── Icons for activity types ──────────────────────────────────────────────
const activityIcons: Record<string, any> = {
  achievement_earned: Trophy,
  game_completed: Swords,
  tournament_won: Trophy,
  court_reviewed: Star,
  level_up: TrendingUp,
  streak_milestone: Flame,
  new_match: Target,
  joined_group: Users,
  coaching_completed: GraduationCap,
  user_post: Newspaper,
};

const activityColors: Record<string, string> = {
  achievement_earned: "text-yellow-400",
  game_completed: "text-[#BFFF00]",
  tournament_won: "text-yellow-400",
  court_reviewed: "text-blue-400",
  level_up: "text-purple-400",
  streak_milestone: "text-orange-400",
  new_match: "text-pink-400",
  joined_group: "text-cyan-400",
  coaching_completed: "text-green-400",
  user_post: "text-[#BFFF00]",
};

const postTypeIcons: Record<string, any> = {
  general: Newspaper,
  highlight: Star,
  question: HelpCircle,
  tip: Lightbulb,
  looking_for_players: Megaphone,
};

const postTypeLabels: Record<string, string> = {
  general: "Post",
  highlight: "Highlight",
  question: "Question",
  tip: "Tip",
  looking_for_players: "LFP",
};

const filterOptions = [
  { value: "all", label: "All" },
  { value: "general", label: "Posts" },
  { value: "highlight", label: "Highlights" },
  { value: "question", label: "Questions" },
  { value: "tip", label: "Tips" },
  { value: "looking_for_players", label: "LFP" },
];

// ── Post Composer ─────────────────────────────────────────────────────────
function PostComposer({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useApp();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<string>("general");
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createPostMutation = trpc.feed.createPost.useMutation({
    onSuccess: () => {
      setContent("");
      setPostType("general");
      toast.success("Post shared!");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    createPostMutation.mutate({ content: trimmed, postType: postType as any });
  };

  const TypeIcon = postTypeIcons[postType] || Newspaper;

  return (
    <div className="card-elevated mx-4 mt-3 p-4">
      <div className="flex gap-3">
        <PlayerAvatar user={{ id: user?.id ?? 0, name: user?.name, profilePhotoUrl: user?.profilePhotoUrl }} size="sm" showBadges={false} />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with the community..."
            className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 min-h-[60px] max-h-[120px]"
            maxLength={2000}
            rows={2}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-2">
              {/* Post type selector */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeSelector(!showTypeSelector)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                    "bg-muted/40 hover:bg-muted/60 text-muted-foreground"
                  )}
                >
                  <TypeIcon className="w-3 h-3" />
                  {postTypeLabels[postType]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTypeSelector && (
                  <div className="absolute top-full left-0 mt-1 bg-background border border-border/50 rounded-lg shadow-xl z-30 py-1 min-w-[140px]">
                    {Object.entries(postTypeLabels).map(([key, label]) => {
                      const Icon = postTypeIcons[key] || Newspaper;
                      return (
                        <button
                          key={key}
                          onClick={() => { setPostType(key); setShowTypeSelector(false); }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted/30 transition-colors",
                            postType === key && "text-[#BFFF00]"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/50">{content.length}/2000</span>
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || createPostMutation.isPending}
              className="h-7 px-3 text-xs bg-[#BFFF00] text-black hover:bg-[#BFFF00]/80 font-semibold"
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
    onSuccess: () => {
      setNewComment("");
      commentsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addCommentMutation.mutate({ postId, content: trimmed });
  };

  const comments = commentsQuery.data ?? [];

  return (
    <div className="mt-2 pt-2 border-t border-border/10">
      {/* Comments list */}
      {commentsQuery.isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-2 mb-2 max-h-[200px] overflow-y-auto">
          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <PlayerAvatar
                user={{ id: c.userId, name: c.userName, profilePhotoUrl: c.userPhoto }}
                size="xs"
                showBadges={false}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-[#BFFF00]">{c.userNickname || c.userName || "Player"}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Add comment input */}
      <div className="flex items-center gap-2">
        <PlayerAvatar
          user={{ id: user?.id ?? 0, name: user?.name, profilePhotoUrl: user?.profilePhotoUrl }}
          size="xs"
          showBadges={false}
        />
        <div className="flex-1 flex items-center gap-1 bg-muted/20 rounded-full px-3 py-1">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
            maxLength={1000}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            className="text-[#BFFF00] disabled:opacity-30 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feed Post Card ────────────────────────────────────────────────────────
function FeedPostCard({ post, onLikeToggle, onDelete }: {
  post: any;
  onLikeToggle: (postId: number) => void;
  onDelete?: (postId: number) => void;
}) {
  const { user, navigate, selectPlayer } = useApp();
  const [showComments, setShowComments] = useState(false);
  const isOwn = post.userId === user?.id;
  const PostTypeIcon = postTypeIcons[post.postType] || Newspaper;

  const handleProfileTap = () => {
    if (post.userId !== user?.id) {
      selectPlayer(post.userId);
      navigate("playerProfile");
    }
  };

  return (
    <div className="card-elevated mx-4 p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={handleProfileTap}>
          <PlayerAvatar
            user={{ id: post.userId, name: post.userName, profilePhotoUrl: post.userPhoto }}
            size="sm"
            showBadges={false}
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={handleProfileTap} className="text-sm font-semibold hover:text-[#BFFF00] transition-colors truncate">
              {post.userNickname || post.userName || "Player"}
            </button>
            {post.userLevel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#BFFF00]/10 text-[#BFFF00] font-medium">
                Lv.{post.userLevel}
              </span>
            )}
            {post.postType !== "general" && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground font-medium">
                <PostTypeIcon className="w-2.5 h-2.5" />
                {postTypeLabels[post.postType]}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
        </div>
        {isOwn && onDelete && (
          <button onClick={() => onDelete(post.id)} className="p-1 text-muted-foreground/40 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap break-words">{post.content}</p>

      {/* Photo */}
      {post.photoUrl && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <img src={post.photoUrl} alt="" className="w-full max-h-[300px] object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/10">
        <button
          onClick={() => onLikeToggle(post.id)}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-all",
            post.isLiked ? "text-pink-400" : "text-muted-foreground/60 hover:text-pink-400"
          )}
        >
          <Heart className={cn("w-4 h-4 transition-transform", post.isLiked && "fill-pink-400 scale-110")} />
          <span>{post.likesCount || ""}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            showComments ? "text-[#BFFF00]" : "text-muted-foreground/60 hover:text-[#BFFF00]"
          )}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{post.commentsCount || ""}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && <CommentSection postId={post.id} />}
    </div>
  );
}

// ── Activity Item Card (for system feed items) ────────────────────────────
function ActivityItemCard({ item }: { item: any }) {
  const Icon = activityIcons[item.activityType] || Activity;
  const color = activityColors[item.activityType] || "text-muted-foreground";

  return (
    <div className="card-elevated mx-4 px-4 py-3 flex gap-3 items-start">
      <div className={cn("mt-0.5 p-2 rounded-full bg-muted/30", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          {item.userName && <span className="text-xs text-[#BFFF00]">{item.userNickname || item.userName}</span>}
          <span className="text-xs text-muted-foreground">{formatTimeAgo(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Feed Screen ──────────────────────────────────────────────────────
export default function ActivityFeedScreen() {
  const { user } = useApp();
  const [tab, setTab] = useState<"posts" | "activity" | "my">("posts");
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Queries
  const postsQuery = trpc.feed.posts.useQuery(
    { limit: 30, offset: 0, filter: filter === "all" ? undefined : filter },
    { enabled: tab === "posts" }
  );
  const communityQuery = trpc.feed.list.useQuery({ limit: 50 }, { enabled: tab === "activity" });
  const myQuery = trpc.feed.my.useQuery({ limit: 50 }, { enabled: tab === "my" });

  // Mutations
  const toggleLikeMutation = trpc.feed.toggleLike.useMutation({
    onSuccess: () => postsQuery.refetch(),
    onError: (err) => toast.error(err.message),
  });
  const deletePostMutation = trpc.feed.deletePost.useMutation({
    onSuccess: () => { postsQuery.refetch(); toast.success("Post deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const handleLikeToggle = useCallback((postId: number) => {
    toggleLikeMutation.mutate({ postId });
  }, []);
  const handleDeletePost = useCallback((postId: number) => {
    deletePostMutation.mutate({ postId });
  }, []);

  const posts: any[] = postsQuery.data ?? [];
  const activityItems: any[] = tab === "activity" ? (communityQuery.data ?? []) : (myQuery.data ?? []);
  const isLoading = tab === "posts" ? postsQuery.isLoading : tab === "activity" ? communityQuery.isLoading : myQuery.isLoading;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Newspaper className="w-5 h-5 text-[#BFFF00]" />
            <h1 className="text-lg font-bold">Feed</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {(["posts", "activity", "my"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  tab === t
                    ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/30"
                    : "bg-muted/30 text-muted-foreground"
                )}
              >
                {t === "posts" ? "Posts" : t === "activity" ? "Activity" : "My Activity"}
              </button>
            ))}
          </div>

          {/* Filter bar (only for posts tab) */}
          {tab === "posts" && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto scrollbar-none pb-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFilter(opt.value); }}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0",
                    filter === opt.value
                      ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40"
                      : "bg-muted/20 text-muted-foreground/70 hover:bg-muted/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post Composer (only on posts tab) */}
      {tab === "posts" && (
        <PostComposer onSuccess={() => postsQuery.refetch()} />
      )}

      {/* Feed Content */}
      <div className="py-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : tab === "posts" ? (
          posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No posts yet</p>
              <p className="text-xs mt-1 opacity-60">Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post: any) => (
              <FeedPostCard
                key={post.id}
                post={post}
                onLikeToggle={handleLikeToggle}
                onDelete={handleDeletePost}
              />
            ))
          )
        ) : (
          activityItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            activityItems.map((item: any) => (
              <ActivityItemCard key={item.id} item={item} />
            ))
          )
        )}
      </div>
    </div>
  );
}
