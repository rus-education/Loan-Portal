import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none flex items-center gap-1",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && <span className="text-destructive font-bold text-sm leading-none">*</span>}
    </label>
  )
);
Label.displayName = "Label";

export { Label };
