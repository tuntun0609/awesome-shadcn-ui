import { cn } from "@/lib/utils";

interface FormFieldShellProps {
  children: React.ReactNode;
  className?: string;
  error?: string;
  htmlFor?: string;
  label: string;
}

export function FormFieldShell({
  children,
  className,
  error,
  htmlFor,
  label,
}: FormFieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="font-medium text-sm leading-none" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
