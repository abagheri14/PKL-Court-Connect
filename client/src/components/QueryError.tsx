import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

/** Inline error state for failed tRPC queries */
export function QueryError({ message, onRetry }: QueryErrorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <AlertTriangle size={20} className="text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-400 mb-1">{t("common.loadError")}</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs">
          <RefreshCw size={12} /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
