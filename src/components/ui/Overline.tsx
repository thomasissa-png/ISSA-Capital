import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type OverlineProps = {
  children: ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
};

/**
 * Overline — petit label avant un titre de section.
 * Respecte WCAG AA : levant-700 sur fond clair (ratio ≥ 4.5:1 sur crème/blanc),
 * levant-500 sur fond sombre. Voir docs/qa/a11y-audit.md (bug A1).
 */
export function Overline({ children, tone = 'dark', className }: OverlineProps): JSX.Element {
  return (
    <p
      className={cn(
        'font-body text-xs font-semibold uppercase tracking-[0.12em]',
        tone === 'dark' ? 'text-levant-700' : 'text-levant-500',
        className,
      )}
    >
      {children}
    </p>
  );
}
