import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Mirrors the Single Window Button (refined look): flat maroon primary,
// 4px radius, semibold. Sizes follow the design: sm 34px, md 36–44px.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-card font-semibold leading-none tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:shadow-focus focus-visible:outline-none active:translate-y-[0.5px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border border-brand bg-brand text-white hover:brightness-110',
        secondary: 'border border-brand-tint2 bg-brand-tint text-brand-strong hover:bg-brand-tint2',
        outline: 'border-[1.5px] border-brand-strong bg-white text-brand-strong hover:bg-brand-tint',
        quiet: 'border border-line bg-surface text-ink-strong hover:border-brand hover:text-brand',
        ghost: 'border border-transparent bg-transparent text-brand-strong hover:bg-surface-hover',
        danger: 'border border-danger bg-danger text-white hover:brightness-95',
      },
      size: {
        xs: 'h-[30px] px-3 text-[12.5px]',
        sm: 'h-[34px] px-4 text-[13px]',
        md: 'h-9 px-[18px] text-sm',
        icon: 'h-[34px] w-[34px] p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'sm' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
