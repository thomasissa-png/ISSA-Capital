import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { siteConfig } from '@/config/site';

/**
 * /mentions-legales — rendu statique (SSG).
 * Mentions légales LCEN + Politique de confidentialité RGPD + clause L.411-1.
 * Métadonnées : noindex, nofollow — conformément à functional-specs.md.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales et politique de confidentialité ISSA Capital.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: { canonical: `${siteConfig.url}/mentions-legales` },
};

const lastUpdate = '2026-04-07';

export default function LegalPage(): JSX.Element {
  return (
    <Section tone="default">
      <Container width="editorial">
        <nav aria-label="Fil d'Ariane" className="text-xs text-ink-500">
          <Link href="/" className="hover:text-ink-950">
            Accueil
          </Link>
          <span className="mx-sm" aria-hidden="true">
            /
          </span>
          <span>Mentions légales</span>
        </nav>

        <h1 className="mt-lg font-heading text-h1 text-ink-950">
          Mentions légales & politique de confidentialité
        </h1>
        <p className="mt-sm text-xs text-ink-500">Dernière mise à jour : {lastUpdate}</p>

        {/* Mentions légales */}
        <section aria-labelledby="mentions" className="mt-2xl">
          <h2 id="mentions" className="font-heading text-h2 text-ink-950">
            Mentions légales
          </h2>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">Éditeur du site</h3>
          <div className="mt-md space-y-xs text-sm text-ink-700">
            <p>Le site issa-capital.com est édité par :</p>
            <p className="font-medium text-ink-950">{siteConfig.legalName}</p>
            <p>Société par Actions Simplifiée (SAS)</p>
            <p>Capital social : {siteConfig.capital}</p>
            <p>
              Siège social : {siteConfig.address.street}, {siteConfig.address.postalCode}{' '}
              {siteConfig.address.city}, France
            </p>
            <p>RCS Nanterre : {siteConfig.siren}</p>
            <p>N° TVA intracommunautaire : {siteConfig.tvaIntra}</p>
            <p>Directeur de la publication : Thomas Issa, Président</p>
            <p>
              Contact :{' '}
              <a
                href={`mailto:${siteConfig.email}`}
                className="text-levant-700 underline"
              >
                {siteConfig.email}
              </a>
            </p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">Hébergeur</h3>
          <div className="mt-md space-y-xs text-sm text-ink-700">
            <p>Ce site est hébergé par :</p>
            <p>Replit, Inc.</p>
            <p>767 Bryant St #203, San Francisco, CA 94107, États-Unis</p>
            <p>contact@repl.it</p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            Propriété intellectuelle
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            L&apos;ensemble des contenus présents sur le site issa-capital.com (textes,
            images, graphismes, logo, icônes, sons, vidéos, etc.) est la propriété
            exclusive d&apos;ISSA Capital ou de ses partenaires, et est protégé par les
            lois françaises et internationales relatives à la propriété intellectuelle.
            Toute reproduction, représentation, modification, publication ou adaptation de
            tout ou partie des éléments du site, quel que soit le moyen ou le procédé
            utilisé, est interdite, sauf autorisation écrite préalable d&apos;ISSA Capital
            (art. L.122-4 Code de la propriété intellectuelle).
          </p>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">Responsabilité</h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            ISSA Capital s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour
            des informations diffusées sur ce site. Toutefois, ISSA Capital ne peut
            garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des
            informations mises à disposition sur ce site.
          </p>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            Clause de non-sollicitation financière
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            Les informations publiées sur ce site ne constituent pas une offre de titres
            financiers, une invitation à investir, ni un démarchage financier au sens des
            articles L.341-1 et suivants du Code monétaire et financier. ISSA Capital est
            une holding patrimoniale familiale non soumise à agrément AMF. Elle
            n&apos;effectue aucun appel public à l&apos;épargne. Les prises de contact via
            ce site sont exclusivement à l&apos;initiative des tiers souhaitant proposer
            des opportunités de rapprochement à ISSA Capital.
          </p>
        </section>

        {/* Politique de confidentialité */}
        <section aria-labelledby="confidentialite" className="mt-3xl">
          <h2
            id="confidentialite"
            className="font-heading text-h2 text-ink-950 scroll-mt-24"
          >
            Politique de confidentialité
          </h2>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            1. Responsable du traitement
          </h3>
          <div className="mt-md space-y-xs text-sm text-ink-700">
            <p>
              Le responsable du traitement des données personnelles collectées sur le site
              issa-capital.com est :
            </p>
            <p>{siteConfig.legalName}</p>
            <p>SAS au capital de {siteConfig.capital}</p>
            <p>
              {siteConfig.address.street}, {siteConfig.address.postalCode}{' '}
              {siteConfig.address.city}, France
            </p>
            <p>RCS Nanterre : {siteConfig.siren}</p>
            <p>Contact délégué à la protection des données : Thomas Issa</p>
            <p>
              Email :{' '}
              <a
                href={`mailto:${siteConfig.email}`}
                className="text-levant-700 underline"
              >
                {siteConfig.email}
              </a>
            </p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            2. Données collectées et finalités
          </h3>
          <div className="mt-md space-y-md text-sm leading-relaxed text-ink-700">
            <p>
              ISSA Capital collecte des données personnelles uniquement via le formulaire
              de contact présent sur le site. Aucune autre collecte de données
              personnelles n&apos;est effectuée.
            </p>
            <p>Données collectées via le formulaire de contact :</p>
            <ul className="list-disc pl-lg">
              <li>Nom et prénom</li>
              <li>Adresse email professionnelle</li>
              <li>
                Informations relatives à la proposition transmise (libre dans le champ
                message)
              </li>
            </ul>
            <p>
              Finalité du traitement : traitement des demandes et propositions adressées à
              ISSA Capital.
            </p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            3. Base légale du traitement
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            Le traitement de vos données personnelles repose sur votre consentement (art.
            6.1.a RGPD), que vous exprimez en soumettant le formulaire de contact. Aucun
            traitement fondé sur l&apos;intérêt légitime ou l&apos;exécution d&apos;un
            contrat n&apos;est mis en œuvre sur ce site.
          </p>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            4. Destinataires des données
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            Les données collectées sont destinées exclusivement aux dirigeants d&apos;ISSA
            Capital. Elles ne sont transmises à aucun tiers, revendues, ni cédées. Les
            données transitent via le service d&apos;envoi d&apos;emails Resend. Ce
            prestataire agit comme sous-traitant au sens de l&apos;art. 28 RGPD et est
            soumis à des garanties contractuelles de protection des données.
          </p>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            5. Durée de conservation
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            Les données collectées via le formulaire de contact sont conservées pendant
            une durée maximale de 3 ans à compter de leur collecte. Passé ce délai, les
            données sont supprimées ou anonymisées.
          </p>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">6. Vos droits</h3>
          <div className="mt-md space-y-md text-sm leading-relaxed text-ink-700">
            <p>
              Conformément aux articles 15 à 21 du RGPD, vous disposez des droits suivants
              : droit d&apos;accès (art. 15), droit de rectification (art. 16), droit à
              l&apos;effacement (art. 17), droit à la limitation du traitement (art. 18),
              droit à la portabilité (art. 20), droit d&apos;opposition (art. 21), droit
              de retirer votre consentement (art. 7.3).
            </p>
            <p>
              Pour exercer vos droits, contactez :{' '}
              <a
                href={`mailto:${siteConfig.email}`}
                className="text-levant-700 underline"
              >
                {siteConfig.email}
              </a>
            </p>
            <p>
              ISSA Capital s&apos;engage à répondre à toute demande dans un délai maximum
              d&apos;un mois à compter de la réception de la demande (art. 12.3 RGPD).
            </p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            7. Réclamation auprès de la CNIL
          </h3>
          <div className="mt-md space-y-xs text-sm text-ink-700">
            <p>
              Si vous estimez que le traitement de vos données n&apos;est pas conforme au
              RGPD, vous avez le droit d&apos;introduire une réclamation auprès de la CNIL
              :
            </p>
            <p>
              En ligne :{' '}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-levant-700 underline"
              >
                https://www.cnil.fr/fr/plaintes
              </a>
            </p>
            <p>
              Par courrier : CNIL — 3 Place de Fontenoy — TSA 80715 — 75334 Paris Cedex 07
            </p>
          </div>

          <h3 className="mt-xl font-heading text-h4 text-ink-950">
            8. Cookies et traceurs
          </h3>
          <p className="mt-md text-sm leading-relaxed text-ink-700">
            Le site issa-capital.com utilise Plausible Analytics, un outil de mesure
            d&apos;audience qui ne dépose aucun cookie sur votre terminal et ne collecte
            aucune donnée personnelle identifiable. Aucun consentement n&apos;est requis
            pour cet outil. Aucun autre cookie de tracking ou de publicité n&apos;est
            utilisé sur ce site.
          </p>
        </section>
      </Container>
    </Section>
  );
}
