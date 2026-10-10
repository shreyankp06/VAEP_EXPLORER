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
      <header className="border-b border-primary/25 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link href="/" className="group shrink-0">
              <p className="font-display text-3xl font-semibold leading-none tracking-tight text-primary sm:text-4xl">
                VAEP <span className="italic font-medium">Explorer</span>
              </p>
            </Link>
            <span aria-hidden="true" className="hidden h-9 w-px bg-primary/20 sm:block" />
            <div className="hidden text-left sm:block">
              <p className="label-meta">Archive status</p>
              <p className="mt-1 font-sans text-xs text-primary">Live match archive</p>
            </div>
          </div>
          <nav aria-label="Primary" className="flex max-w-full gap-1 overflow-x-auto border-y border-primary/20 py-1 sm:border-y-0 sm:py-0">
            {NAV_ITEMS.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'shrink-0 px-3 py-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] transition-colors sm:px-3',
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
