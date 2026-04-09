import Link from 'next/link';
import { siteConfig } from '@/config/site';

/**
 * Footer — pied de page ISSA Capital.
 * Fond ink-950, clause de non-démarchage L.411-1, liens, baseline.
 * Landmark `contentinfo`.
 */
export function Footer(): JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-950 text-parchment-100">
      <div className="mx-auto max-w-content px-md py-3xl md:px-xl">
        <div className="grid gap-2xl md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="font-heading text-2xl text-parchment-100">{siteConfig.name}</p>
            <p className="mt-sm font-heading italic text-ink-300">{siteConfig.baseline}</p>
            <address className="mt-lg not-italic text-sm leading-relaxed text-ink-300">
              {siteConfig.legalName}
              <br />
              SIREN {siteConfig.siren}
              <br />
              {siteConfig.address.street}
              <br />
              {siteConfig.address.postalCode} {siteConfig.address.city}
              <br />
              <a
                href={`mailto:${siteConfig.email}`}
                className="mt-sm inline-block text-levant-400 hover:text-levant-300"
              >
                {siteConfig.email}
              </a>
            </address>
          </div>

          <nav aria-label="Pied de page" className="md:col-span-4">
            {/* C14 : .overline n'est pas une classe Tailwind valide — classes primitives explicites */}
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Navigation</p>
            <ul className="mt-md space-y-sm">
              {siteConfig.footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-200 hover:text-parchment-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            {/* C14 : idem — .overline invalide → classes primitives */}
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">Mention légale</p>
            <p className="mt-md text-xs leading-relaxed text-ink-300">
              Les informations publiées sur ce site ne constituent pas une offre de titres
              financiers, une invitation à investir, ni un démarchage financier au sens des
              articles L.341-1 et suivants du Code monétaire et financier. ISSA Capital est une
              holding patrimoniale familiale non soumise à agrément AMF.
            </p>
          </div>
        </div>

        <div className="mt-3xl border-t border-ink-800 pt-lg text-xs text-ink-400">
          <p>
            © {year} {siteConfig.legalName} — Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
