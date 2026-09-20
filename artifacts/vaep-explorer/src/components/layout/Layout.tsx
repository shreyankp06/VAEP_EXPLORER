import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Trophy, 
  Play, 
  ScatterChart, 
  ChevronLeft, 
  Menu, 
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/replay', label: 'Action Replay', icon: Play },
  { href: '/scatter', label: 'Quality vs Quantity', icon: ScatterChart },
];

const PAGE_INFO: Record<string, { title: string, subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview of VAEP metrics across all matches and players' },
  '/leaderboard': { title: 'VAEP Leaderboard', subtitle: 'Players ranked by cumulative VAEP score' },
  '/replay': { title: 'Action Replay', subtitle: 'Visualise action sequences on the pitch with VAEP values' },
  '/scatter': { title: 'Quality vs Quantity', subtitle: 'VAEP per action vs total actions — identifying efficient players' },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setCollapsed(true);
      return;
    }
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const pageInfo = PAGE_INFO[location] || { title: 'VAEP Explorer', subtitle: 'Football Analytics' };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center px-4 justify-between border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-sidebar-primary" />
              <div className="flex flex-col leading-none">
                <span className="font-bold tracking-tight text-sidebar-foreground">VAEP</span>
                <span className="text-xs text-sidebar-foreground/60">Explorer</span>
              </div>
            </div>
          )}
          {collapsed && <Activity className="h-6 w-6 text-sidebar-primary mx-auto" />}
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-sidebar-primary" : "")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border flex flex-col gap-4">
          <button 
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggleSidebar}
            className="flex items-center justify-center h-8 w-full rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          
          {!collapsed && (
            <div className="text-xs text-sidebar-foreground/40 leading-tight">
              Valuing Actions by Estimating Probabilities. 
              <div className="mt-1 font-medium text-sidebar-foreground/60">StatsBomb Open Data</div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b bg-card">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight leading-tight">{pageInfo.title}</h1>
            <p className="text-sm text-muted-foreground leading-tight">{pageInfo.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs font-medium text-primary">Live Supabase</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
