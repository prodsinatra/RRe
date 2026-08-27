import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/src/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hover disabled:pointer-events-none disabled:opacity-50 relative after:absolute after:left-1/2 after:top-1/2 after:w-[max(100%,2.75rem)] after:h-[max(100%,2.75rem)] after:-translate-x-1/2 after:-translate-y-1/2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:bg-brand-hover active:translate-y-[1px]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-[1px]",
        outline: "border border-input bg-background hover:bg-surface-raised hover:text-foreground active:translate-y-[1px]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:translate-y-[1px]",
        ghost: "hover:bg-surface-raised hover:text-foreground active:translate-y-[1px]",
        link: "text-primary underline-offset-4 hover:underline !p-0 !h-auto after:min-w-11 after:min-h-11",
        hero: "bg-primary text-primary-foreground shadow-glow hover:bg-brand-hover active:translate-y-[1px]",
        quiet: "bg-surface border border-border-strong text-foreground hover:bg-surface-raised hover:border-brand-border active:translate-y-[1px]",
        terminal: "bg-[#141416] border border-[#27272a] text-zinc-300 font-mono text-xs rounded-none hover:bg-lime-400 hover:text-black hover:border-lime-400 active:translate-y-[1px] hardware-cut",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
