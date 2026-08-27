import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/src/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border-strong bg-transparent",
        accent: "border-accent-border bg-accent-soft text-accent shadow-glow-accent",
        brand: "border-brand-border bg-brand-soft text-primary-glow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

const stateChipVariants = cva(
  "inline-flex items-center gap-1.5 border rounded-sm px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        processing: "border-accent-border bg-accent-soft text-accent shadow-glow-accent",
        featured: "border-accent-border bg-accent-soft text-accent shadow-glow-accent",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-400",
        danger: "border-transparent bg-destructive text-destructive-foreground",
        neutral: "border-border-strong bg-surface text-muted-foreground",
        brand: "border-brand-border bg-brand-soft text-primary-glow",
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
)

export interface StateChipProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof stateChipVariants> {
  showDot?: boolean;
}

function StateChip({ className, variant, showDot = true, children, ...props }: StateChipProps) {
  return (
    <div className={cn(stateChipVariants({ variant }), className)} {...props}>
      {showDot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

export { Badge, badgeVariants, StateChip, stateChipVariants }

