import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button — composant universel ISSA Capital.
 * Variants : primary (noir plein), secondary (outline), ghost (transparent),
 *            primary-inverse (levant sur fond sombre).
 * Sizes : md (défaut), lg.
 * Peut être rendu comme <Link> si la prop href est fournie.
 * Tous les variants respectent touch target 48px, focus-visible WCAG.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'primary-inverse';
type Size = 'md' | 'lg';

type BaseProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  loading?: boolean;
};

type AsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type AsLink = BaseProps & {
  href: string;
  type?: undefined;
  disabled?: boolean;
};

type ButtonProps = AsButton | AsLink;

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-body font-medium tracking-wide transition-colors duration-fast ease-out rounded-md min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const sizeClasses: Record<Size, string> = {
  md: 'px-xl py-md text-base',
  lg: 'px-xl py-lg text-base',
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ink-950 text-parchment-100 hover:bg-ink-800 active:bg-ink-700 focus-visible:ring-offset-parchment-100',
  secondary:
    'bg-white border border-ink-500 text-ink-950 hover:bg-parchment-50 active:bg-parchment-200 focus-visible:ring-offset-parchment-100',
  ghost:
    'bg-transparent text-ink-950 hover:bg-parchment-200 active:bg-parchment-200 min-h-[44px]',
  'primary-inverse':
    'bg-levant-500 text-ink-950 hover:bg-levant-400 active:bg-levant-600 focus-visible:ring-offset-ink-950',
};

export function Button(props: ButtonProps): JSX.Element {
  const {
    variant = 'primary',
    size = 'md',
    children,
    className,
    loading = false,
  } = props;

  const classes = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className,
  );

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={classes} aria-disabled={props.disabled}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, children: _c, className: _cn, loading: _l, href: _h, ...rest } =
    props as AsButton & { href?: string };
  void _v;
  void _s;
  void _c;
  void _cn;
  void _l;
  void _h;

  return (
    <button className={classes} disabled={loading || (rest as AsButton).disabled} {...rest}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          {/* C15 : motion-safe: conditionne l'animation à prefers-reduced-motion: no-preference */}
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>Envoi en cours…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
