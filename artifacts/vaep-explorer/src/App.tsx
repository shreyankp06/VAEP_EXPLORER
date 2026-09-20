import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { Layout } from '@/components/layout/Layout';
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const LeaderboardPage = lazy(() => import('@/pages/leaderboard'));
const ReplayPage = lazy(() => import('@/pages/replay'));
const ScatterPage = lazy(() => import('@/pages/scatter'));

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading page…</div>}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/replay" component={ReplayPage} />
          <Route path="/scatter" component={ScatterPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
