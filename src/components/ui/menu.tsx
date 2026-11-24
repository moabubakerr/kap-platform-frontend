import * as React from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import * as Tip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export const MenuContent = React.forwardRef<HTMLDivElement, DM.DropdownMenuContentProps>(({ className, sideOffset = 6, ...props }, ref) => (
  <DM.Portal>
    <DM.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn('z-[70] min-w-[260px] rounded-card border border-line-subtle bg-surface p-1.5 text-ink-body shadow-menu', className)}
      {...props}
    />
  </DM.Portal>
));
MenuContent.displayName = 'MenuContent';

export const MenuItem = React.forwardRef<HTMLDivElement, DM.DropdownMenuItemProps>(({ className, ...props }, ref) => (
  <DM.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13.5px] outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  />
));
MenuItem.displayName = 'MenuItem';

export const MenuLabel = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-subtle', className)} {...p} />
);

export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line-subtle" />;

export const TooltipProvider = Tip.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tip.Root delayDuration={250}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content side={side} sideOffset={6} className="z-[90] max-w-xs rounded-sm bg-[#1F1A1C] px-2 py-1 text-xs text-white shadow-menu">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
