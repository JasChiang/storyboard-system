import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-transparent text-sm font-medium tracking-[-0.01em] ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_16px_34px_-20px_hsl(var(--primary)/0.95)] hover:bg-primary/92 hover:shadow-[0_20px_40px_-20px_hsl(var(--primary)/0.9)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_16px_34px_-20px_hsl(var(--destructive)/0.95)] hover:bg-destructive/92",
        outline: "border-border/80 bg-white/90 text-foreground shadow-[0_12px_24px_-20px_rgba(15,23,42,0.55)] hover:border-primary/30 hover:bg-white hover:text-primary dark:bg-slate-900/80",
        secondary: "bg-secondary text-secondary-foreground shadow-[0_10px_26px_-22px_rgba(15,23,42,0.55)] hover:bg-secondary/85",
        ghost: "text-foreground/85 hover:bg-foreground/[0.05] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> { }

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
