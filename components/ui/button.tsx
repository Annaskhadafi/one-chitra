import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:shadow-blue-500/20",
        destructive:
          "bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:from-red-700 hover:to-pink-700 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:from-red-500 dark:to-pink-500",
        outline:
          "border bg-gradient-to-r from-background to-accent/20 shadow-xs hover:from-accent hover:to-accent hover:text-accent-foreground dark:from-input/30 dark:to-input/10 dark:border-input dark:hover:from-input/50 dark:hover:to-input/30",
        secondary:
          "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 shadow-xs hover:from-slate-300 hover:to-slate-400 dark:from-slate-700 dark:to-slate-800 dark:text-slate-100",
        ghost:
          "hover:bg-gradient-to-r hover:from-accent hover:to-accent/80 hover:text-accent-foreground dark:hover:from-accent/50 dark:hover:to-accent/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
