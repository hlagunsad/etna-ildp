import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/* Reusable, accessible UI primitives styled to the design tokens in globals.css. */

export function Card({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(28,27,23,0.04),0_10px_30px_-18px_rgba(28,27,23,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.6rem] font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const base = "inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50";
  const sizes: Record<string, string> = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-4 text-[0.9rem]", // 44px min touch target
  };
  const variants: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-700",
    secondary: "border border-line bg-surface text-ink hover:bg-brand-50",
    ghost: "text-brand hover:bg-brand-50",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

type Tone = "neutral" | "brand" | "success" | "warn" | "danger" | "info";

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-chip text-muted",
    brand: "bg-brand-50 text-brand",
    success: "bg-success-50 text-success",
    warn: "bg-amber-50 text-amber",
    danger: "bg-danger-50 text-danger",
    info: "bg-brand-50 text-brand",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[0.9rem] text-ink placeholder:text-faint outline-none transition focus:border-brand";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</div>}
    </Card>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden="true" />
      {label}
    </div>
  );
}
