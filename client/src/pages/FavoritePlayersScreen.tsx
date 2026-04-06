import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName } from "@/lib/avatarUtils";
import { ArrowLeft, Heart, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function FavoritePlayersScreen() {
  const { goBack, selectPlayer } = useApp();
  const utils = trpc.useUtils();
  const favQuery = trpc.favorites.list.useQuery();
  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => { utils.favorites.list.invalidate(); toast.success("Removed from favorites"); },
  });

  const players: any[] = favQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Heart className="w-5 h-5 text-pink-400" />
          <h1 className="text-lg font-bold">Favorite Players</h1>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {favQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No favorite players yet</p>
            <p className="text-xs mt-1">Tap the heart icon on player profiles to save them</p>
          </div>
        ) : (
          players.map((p: any) => (
            <div
              key={p.favoriteId}
              className="card-elevated px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => selectPlayer(p.favoriteId)}
            >
              <PlayerAvatar user={p} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{getDisplayName(p)}</p>
                {p.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.city}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeMutation.mutate({ favoriteId: p.favoriteId }); }}
                className="p-2 rounded-full hover:bg-muted/50 text-pink-400"
              >
                <Heart className="w-4 h-4 fill-current" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
