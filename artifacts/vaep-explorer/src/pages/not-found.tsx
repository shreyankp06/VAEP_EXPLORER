import { Link } from 'wouter';
import { PaperPanel } from '@/components/archive/Ornaments';

export default function NotFound() {
  return (
    <PaperPanel className="py-20 text-center">
      <p className="label-meta">Erratum</p>
      <h1 className="font-display mt-2 text-5xl text-primary">This plate is missing</h1>
      <p className="mt-3 text-muted-foreground">The requested page is not in the archive.</p>
      <Link className="mt-6 inline-block border-b border-primary font-sans text-sm uppercase tracking-[0.18em] text-primary" href="/">
        Return to the atlas
      </Link>
    </PaperPanel>
  );
}
