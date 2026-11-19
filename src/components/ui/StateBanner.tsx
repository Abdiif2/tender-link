import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { AppButton } from './AppButton';

export type BannerVariant = 'empty' | 'error' | 'offline' | 'warning' | 'success';

interface StateBannerProps {
  variant: BannerVariant;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}

const styleByVariant: Record<
  BannerVariant,
  {
    container: string;
    iconColor: string;
    titleColor: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    role: 'status' | 'alert';
  }
> = {
  empty: {
    container: 'bg-white border-[#E2E8F0]',
    iconColor: 'text-[#64748B]',
    titleColor: 'text-[#0B1F3A]',
    Icon: Inbox,
    role: 'status',
  },
  error: {
    container: 'bg-[#FEF2F2] border-[#FECACA]',
    iconColor: 'text-[#B91C1C]',
    titleColor: 'text-[#7F1D1D]',
    Icon: XCircle,
    role: 'alert',
  },
  offline: {
    container: 'bg-[#FFFBEB] border-[#FDE68A]',
    iconColor: 'text-[#B45309]',
    titleColor: 'text-[#78350F]',
    Icon: WifiOff,
    role: 'alert',
  },
  warning: {
    container: 'bg-[#FFFBEB] border-[#FDE68A]',
    iconColor: 'text-[#B45309]',
    titleColor: 'text-[#78350F]',
    Icon: AlertTriangle,
    role: 'status',
  },
  success: {
    container: 'bg-emerald-50/80 border-emerald-200',
    iconColor: 'text-[#15803D]',
    titleColor: 'text-emerald-900',
    Icon: CheckCircle2,
    role: 'status',
  },
};

export function StateBanner({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: StateBannerProps) {
  const { container, iconColor, titleColor, Icon, role } = styleByVariant[variant];

  return (
    <div
      role={role}
      className={`rounded-2xl border ${container} ${
        compact ? 'p-4' : 'p-6 sm:p-8'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3.5">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} aria-hidden={true} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className={`text-sm sm:text-base font-semibold ${titleColor}`}>
            {title}
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed max-w-[68ch]">
            {description}
          </p>
          {(actionLabel || secondaryLabel) && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {actionLabel && onAction && (
                <AppButton size="sm" variant="primary" onClick={onAction}>
                  {actionLabel}
                </AppButton>
              )}
              {secondaryLabel && onSecondary && (
                <AppButton size="sm" variant="secondary" onClick={onSecondary}>
                  {secondaryLabel}
                </AppButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
