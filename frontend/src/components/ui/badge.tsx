import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:   "bg-primary/10 text-primary border border-primary/20",
        success:   "bg-success-muted text-success border border-success/20",
        danger:    "bg-danger-muted text-danger border border-danger/20",
        warning:   "bg-warning-muted text-warning border border-warning/20",
        secondary: "bg-secondary text-secondary-foreground border border-border",
        outline:   "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
