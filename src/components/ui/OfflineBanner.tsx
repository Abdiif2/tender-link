import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface OfflineBannerProps {
  simulatedOffline?: boolean;
  onRestoreSimulated?: () => void;
}

export function OfflineBanner({
  simulatedOffline = false,
  onRestoreSimulated,
}: OfflineBannerProps) {
  const { t } = useLanguage();
  const [browserOffline, setBrowserOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOffline(false);
    const handleOffline = () => setBrowserOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!browserOffline && !simulatedOffline) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-[#FFFBEB] border-b border-[#FDE68A] text-[#78350F]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t.states.offlineTitle}:</span>
          <span className="text-[#92400E]">{t.states.offlineBody}</span>
        </div>
        {simulatedOffline && onRestoreSimulated && (
          <button
            type="button"
            onClick={onRestoreSimulated}
            className="text-xs font-semibold underline text-[#78350F] hover:text-[#451A03] whitespace-nowrap cursor-pointer"
          >
            {t.uiKit.restoreOnlineBtn}
          </button>
        )}
      </div>
    </div>
  );
}
