import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function EngravedFootball({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('text-primary', className)} fill="none" viewBox="0 0 160 160">
      <defs>
        <pattern id="ball-hatch" height="4" patternUnits="userSpaceOnUse" width="4">
          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="currentColor" strokeWidth="0.35" />
        </pattern>
      </defs>
      <circle cx="80" cy="80" r="62" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="80" cy="80" r="58" stroke="currentColor" strokeWidth="0.4" />
      <polygon fill="url(#ball-hatch)" points="80,52 96,64 90,82 70,82 64,64" stroke="currentColor" strokeWidth="0.7" />
      <path d="M80 52 L54 38 M80 52 L106 38 M64 64 L38 58 M96 64 L122 58 M70 82 L48 104 M90 82 L112 104" stroke="currentColor" strokeWidth="0.7" />
      <path d="M54 38 Q80 22 106 38 M38 58 Q28 80 48 104 M122 58 Q132 80 112 104 M48 104 Q80 126 112 104" stroke="currentColor" strokeWidth="0.55" />
      <circle cx="80" cy="80" r="70" opacity="0.35" stroke="currentColor" strokeDasharray="1.2 2.4" strokeWidth="0.35" />
    </svg>
  );
}

export function FolioCorner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('text-primary/35', className)} fill="none" viewBox="0 0 32 32">
      <path d="M4 4 H26 M4 4 V26" stroke="currentColor" strokeLinecap="square" strokeWidth="0.7" />
      <path d="M4 9 H13 M9 4 V13" stroke="currentColor" strokeWidth="0.35" />
      <circle cx="4" cy="4" fill="currentColor" r="1" stroke="none" />
    </svg>
  );
}

export function GoalGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 18 V7 H20 V18" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4 7 L12 4 L20 7" stroke="currentColor" strokeWidth="0.8" />
      <path d="M7 18 V10 H17 V18" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

export function ShotGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="8" cy="12" r="2.2" stroke="currentColor" strokeWidth="0.9" />
      <path d="M11 12 H20 M16 8 L20 12 L16 16" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

export function CardGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="1" stroke="currentColor" strokeWidth="0.9" width="10" x="7" y="5" />
    </svg>
  );
}

export function SubGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 16 L7 8 L4 11 M17 8 L17 16 L20 13" stroke="currentColor" strokeWidth="0.95" />
    </svg>
  );
}

export function VaepGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 16 L8 8 L12 16 M6.2 13 H9.8 M13 16 V8 L20 16 V8" stroke="currentColor" strokeWidth="0.95" />
    </svg>
  );
}

export function SectionHeading({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside?: string;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-primary/25 pb-3">
      <div>
        <p className="label-meta">{kicker}</p>
        <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight text-primary md:text-4xl">{title}</h2>
      </div>
      {aside ? <p className="max-w-sm text-right text-sm text-muted-foreground">{aside}</p> : null}
    </header>
  );
}

export function PaperPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative border border-primary/25 bg-card/80 p-5 md:p-6', className)}>
      <FolioCorner className="pointer-events-none absolute left-1 top-1 h-10 w-10" />
      {children}
    </section>
  );
}

export function CatalogSelect({
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="label-meta">{label}</span>
      <select
        className="h-9 border border-primary/30 bg-background/60 px-3 font-sans text-sm text-foreground outline-none focus:border-primary"
        {...props}
      />
    </label>
  );
}
