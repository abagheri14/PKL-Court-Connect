import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500/90 backdrop-blur text-white text-center text-xs py-1.5 font-medium flex items-center justify-center gap-1.5 safe-area-top">
      <WifiOff size={12} />
      {t("common.offlineBanner")}
    </div>
  );
}
