import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Match report' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/leaderboard', label: 'Players' },
  { href: '/scatter', label: 'Quality' },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] text-foreground">
      <header className="border-b border-primary/25 bg-[hsl(42_40%_94%/0.86)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Link href="/" className="group">
              <p className="label-meta">Vol. I · Interactive football archive</p>
              <p className="font-display text-4xl font-semibold leading-none tracking-tight text-primary md:text-5xl">
                VAEP <span className="italic font-medium">Explorer</span>
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                An interactive archive for valuing football actions by estimating probabilities.
              </p>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="label-meta">Archive status</p>
              <p className="mt-1 font-sans text-sm text-primary">Live catalogue · 2023/24</p>
            </div>
          </div>
          <nav aria-label="Primary" className="flex gap-1 overflow-x-auto border-y border-primary/20 py-2">
            {NAV_ITEMS.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'shrink-0 px-4 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                  )}
                >
                  <span className={cn('border-b', active ? 'border-primary pb-1' : 'border-transparent')}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
