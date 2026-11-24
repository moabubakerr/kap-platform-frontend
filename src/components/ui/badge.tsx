import * as React from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'teal' | 'sand';

const soft: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  brand: 'bg-brand-tint text-brand-strong',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info',
  teal: 'bg-teal-tint text-teal',
  sand: 'bg-sand-tint text-sand-ink',
};
const solid: Record<Tone, string> = {
  neutral: 'bg-neutral-700 text-white',
  brand: 'bg-brand text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
  info: 'bg-info text-white',
  teal: 'bg-teal text-white',
  sand: 'bg-sand text-[#3A2A12]',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: 'soft' | 'solid' | 'outline';
  mono?: boolean;
}

/** Single Window Badge: 22px, 12px semibold, 4px radius (refined). */
export function Badge({ tone = 'neutral', variant = 'soft', mono, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-card px-[9px] text-xs font-semibold leading-none tracking-[-0.01em]',
        variant === 'solid' ? solid[tone] : soft[tone],
        variant === 'outline' && 'border border-current bg-transparent',
        mono && 'font-mono font-medium',
        className,
      )}
      {...props}
    />
  );
}
