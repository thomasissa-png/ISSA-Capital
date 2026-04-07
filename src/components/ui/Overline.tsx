import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type OverlineProps = {
  children: ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
};

/**
 * Overline — petit label avant un titre de section.
 * Respecte WCAG : levant-600 sur fond clair, levant-500 sur fond sombre.
 */
export function Overline({ children, tone = 'dark', className }: OverlineProps): JSX.Element {
  return (
    <p
      className={cn(
        'font-body text-xs font-semibold uppercase tracking-[0.12em]',
        tone === 'dark' ? 'text-levant-600' : 'text-levant-500',
        className,
      )}
    >
      {children}
    </p>
  );
}
