'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/cn';

/**
 * Header — navigation principale ISSA Capital.
 * Sticky, fond parchment avec backdrop-blur au scroll, menu burger mobile.
 * Respecte l'accessibilité : landmarks, ARIA, touch targets 44px+.
 */
export function Header(): JSX.Element {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /**
   * Force le scroll en haut de page après une navigation depuis le menu top.
   * Next.js conserve parfois la position de scroll lors du changement de route ;
   * ici on garantit que cliquer sur un item de menu ramène toujours au top de
   * la page de destination, qu'on soit déjà sur cette page ou non.
   */
  const handleNavClick = (): void => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-colors duration-normal',
        scrolled
          ? 'border-ink-100 bg-parchment-100/95 backdrop-blur'
          : 'border-transparent bg-parchment-100',
      )}
    >
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-content items-center justify-between px-md md:h-[72px] md:px-xl"
      >
        <Link
          href="/"
          onClick={handleNavClick}
          className="font-heading text-xl tracking-tight text-ink-950 hover:text-ink-700"
        >
          {siteConfig.name}
        </Link>

        {siteConfig.nav.length > 0 && (
          <ul className="hidden items-center gap-xl md:flex">
            {siteConfig.nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      'font-body text-sm transition-colors',
                      active
                        ? 'text-ink-950 underline underline-offset-4 decoration-levant-500'
                        : 'text-ink-700 hover:text-ink-950',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {siteConfig.nav.length > 0 && (
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-950 hover:bg-parchment-200 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        )}
      </nav>

      {mobileOpen && siteConfig.nav.length > 0 ? (
        <div
          id="mobile-nav"
          className="border-t border-ink-100 bg-parchment-100 md:hidden"
        >
          <ul className="flex flex-col px-md py-md">
            {siteConfig.nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      'block min-h-[48px] py-md font-body text-base',
                      active ? 'text-ink-950' : 'text-ink-700',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
