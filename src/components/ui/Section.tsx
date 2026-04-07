import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'subtle' | 'elevated' | 'inverse';

type SectionProps = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  id?: string;
  as?: 'section' | 'article' | 'div';
};

const toneClasses: Record<Tone, string> = {
  default: 'bg-parchment-100 text-ink-950',
  subtle: 'bg-parchment-50 text-ink-950',
  elevated: 'bg-white text-ink-950',
  inverse: 'bg-ink-950 text-parchment-100',
};

/**
 * Section — bloc de page plein-largeur avec padding vertical responsive.
 * Tons alignés sur la règle "alternance de fonds" de page-compositions.md.
 */
export function Section({
  tone = 'default',
  children,
  className,
  id,
  as: Tag = 'section',
}: SectionProps): JSX.Element {
  return (
    <Tag
      id={id}
      className={cn(
        'w-full py-2xl md:py-4xl',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
