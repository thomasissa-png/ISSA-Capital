'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

/**
 * ContactForm — composant universel pour les 3 variants :
 *  - "contact"         : Prénom/Nom, Email, Sujet, Message (page /contact)
 *  - "accompagnement"  : Prénom/Nom, Email, Message (page /accompagnement)
 *  - "opportunite"     : Prénom/Nom, Email, Type, Localisation, Description, Ticket, Source (page /opportunites)
 *
 * États UI supportés (gate G21) :
 *  1. default  — formulaire vide prêt à remplir
 *  2. loading  — bouton en "Envoi en cours…"
 *  3. vide     — pas applicable (pas de liste) → comportement = default
 *  4. erreur   — message d'erreur visible + conservation du contenu saisi
 *  5. succès   — remplace le formulaire par un message de confirmation
 *
 * Accessibilité : labels liés, aria-describedby pour les erreurs, honeypot hors viewport,
 * consentement RGPD obligatoire, focus géré, messages aria-live.
 */

type Variant = 'contact' | 'accompagnement' | 'opportunite';

type ContactFormProps = {
  variant: Variant;
  heading?: string;
  intro?: ReactNode;
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const rgpdText = (
  <>
    Les informations que vous transmettez via ce formulaire sont collectées par ISSA
    Capital (SAS, 54 Rue Henri Barbusse, 92000 Nanterre) pour traiter votre demande ou
    proposition. Elles sont destinées aux dirigeants d&apos;ISSA Capital et conservées 3
    ans maximum. Vous pouvez exercer vos droits d&apos;accès, de rectification et de
    suppression en écrivant à contact@issa-capital.com. Pour en savoir plus, consultez
    notre{' '}
    <Link
      href="/mentions-legales#confidentialite"
      className="underline underline-offset-2 hover:text-levant-700"
    >
      politique de confidentialité
    </Link>
    .
  </>
);

const labelClass = 'block font-body text-sm font-medium text-ink-800 mb-sm';
const inputClass =
  'w-full rounded-sm border border-ink-200 bg-white px-md py-md text-base text-ink-950 placeholder:text-ink-400 transition-colors duration-fast focus-visible:border-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white min-h-[48px]';
const errorClass = 'mt-xs text-sm text-reserve-600';

export function ContactForm({ variant, heading, intro }: ContactFormProps): JSX.Element {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // Type d'opportunité sélectionné — drive le caractère requis du champ Localisation.
  const [opportunityType, setOpportunityType] = useState<string>('');
  const locationRequired =
    variant === 'opportunite' && opportunityType === 'immobilier_residentiel';

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus('submitting');
    setServerError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const raw: Record<string, unknown> = Object.fromEntries(formData.entries());

    // Normalisation : checkbox 'consent' devient bool
    raw['consent'] = formData.get('consent') === 'on';
    raw['variant'] = variant;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        fields?: Record<string, string[]>;
      };

      if (res.ok && data.success) {
        setStatus('success');
        return;
      }

      if (res.status === 400 && data.fields) {
        setFieldErrors(data.fields);
        setServerError(
          data.message ?? 'Certains champs sont invalides. Merci de vérifier.',
        );
      } else if (res.status === 429) {
        setServerError(
          data.message ?? 'Trop de demandes. Merci de réessayer dans quelques minutes.',
        );
      } else {
        setServerError(
          data.message ??
            "Le message n'a pas pu être envoyé. Merci d'écrire directement à contact@issa-capital.com.",
        );
      }
      setStatus('error');
    } catch {
      setServerError(
        "Le message n'a pas pu être envoyé. Merci d'écrire directement à contact@issa-capital.com.",
      );
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div
        className="border border-ink-200 bg-white p-2xl"
        role="status"
        aria-live="polite"
      >
        <p className="font-heading text-2xl text-ink-950">Message transmis.</p>
        <p className="mt-md text-base text-ink-700">
          {variant === 'opportunite'
            ? 'Votre proposition a été transmise. Nous étudions chaque dossier soumis et prenons contact avec les opportunités qualifiées. Nous revenons vers vous sous 72h.'
            : 'Votre message a été transmis. Nous répondons aux demandes qualifiées.'}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border border-ink-200 bg-white p-xl md:p-2xl"
      aria-labelledby={heading ? 'contact-form-heading' : undefined}
    >
      {heading ? (
        <h2 id="contact-form-heading" className="font-heading text-h3 text-ink-950">
          {heading}
        </h2>
      ) : null}
      {intro ? <div className="mt-sm text-sm text-ink-700">{intro}</div> : null}

      <div className="mt-xl space-y-lg">
        {/* Honeypot — hors viewport, invisible pour les humains */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Site web (ne pas remplir)</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="name" className={labelClass}>
            Prénom et nom <span aria-hidden="true">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Antoine Vasseur"
            className={cn(inputClass, fieldErrors['name'] && 'border-reserve-500')}
            aria-invalid={Boolean(fieldErrors['name'])}
            aria-describedby={fieldErrors['name'] ? 'name-error' : undefined}
          />
          {fieldErrors['name'] ? (
            <p id="name-error" className={errorClass}>
              {fieldErrors['name'][0]}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            {variant === 'opportunite' ? 'Email professionnel' : 'Email'}{' '}
            <span aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@votredomaine.com"
            className={cn(inputClass, fieldErrors['email'] && 'border-reserve-500')}
            aria-invalid={Boolean(fieldErrors['email'])}
            aria-describedby={fieldErrors['email'] ? 'email-error' : undefined}
          />
          {fieldErrors['email'] ? (
            <p id="email-error" className={errorClass}>
              {fieldErrors['email'][0]}
            </p>
          ) : null}
        </div>

        {variant === 'contact' ? (
          <div>
            <label htmlFor="subject" className={labelClass}>
              Sujet <span aria-hidden="true">*</span>
            </label>
            <select id="subject" name="subject" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Choisir un sujet
              </option>
              <option value="opportunite">Opportunité d&apos;affaires</option>
              <option value="accompagnement">Accompagnement / conseil</option>
              <option value="presse">Demande presse</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        ) : null}

        {variant === 'opportunite' ? (
          <>
            <div>
              <label htmlFor="opportunityType" className={labelClass}>
                Type d&apos;opportunité <span aria-hidden="true">*</span>
              </label>
              <select
                id="opportunityType"
                name="opportunityType"
                required
                className={inputClass}
                value={opportunityType}
                onChange={(e) => setOpportunityType(e.target.value)}
              >
                <option value="" disabled>
                  Choisir un type
                </option>
                <option value="immobilier_residentiel">Immobilier résidentiel</option>
                <option value="participation_entreprise">Participation dans une entreprise</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label htmlFor="location" className={labelClass}>
                Localisation / Périmètre géographique
                {locationRequired ? (
                  <>
                    {' '}
                    <span aria-hidden="true">*</span>
                    <span className="ml-xs text-xs font-normal text-ink-500">
                      (requis pour une opportunité immobilière)
                    </span>
                  </>
                ) : null}
              </label>
              <input
                id="location"
                name="location"
                type="text"
                required={locationRequired}
                aria-required={locationRequired}
                placeholder="Ex. : Paris 11e, Montreuil, Île-de-France"
                className={cn(inputClass, fieldErrors['location'] && 'border-reserve-500')}
                aria-invalid={Boolean(fieldErrors['location'])}
                aria-describedby={fieldErrors['location'] ? 'location-error' : undefined}
              />
              {fieldErrors['location'] ? (
                <p id="location-error" className={errorClass}>
                  {fieldErrors['location'][0]}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description courte de l&apos;opportunité{' '}
                <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                maxLength={500}
                placeholder="Décrivez votre opportunité en 2-3 lignes : nature, localisation ou secteur, taille indicative."
                className={cn(inputClass, 'min-h-[120px] resize-y')}
                aria-describedby={fieldErrors['description'] ? 'description-error' : undefined}
              />
              {fieldErrors['description'] ? (
                <p id="description-error" className={errorClass}>
                  {fieldErrors['description'][0]}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="ticket" className={labelClass}>
                Taille indicative du ticket
              </label>
              <input
                id="ticket"
                name="ticket"
                type="text"
                placeholder="Ex. : 500 000 €"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="source" className={labelClass}>
                Comment avez-vous connu ISSA Capital ?
              </label>
              <select id="source" name="source" className={inputClass} defaultValue="">
                <option value="">— (facultatif)</option>
                <option value="linkedin">LinkedIn</option>
                <option value="recommandation">Recommandation</option>
                <option value="recherche">Recherche internet</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </>
        ) : null}

        {variant !== 'opportunite' ? (
          <div>
            <label htmlFor="message" className={labelClass}>
              Message <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              maxLength={1000}
              placeholder={
                variant === 'accompagnement'
                  ? 'Décrivez en deux lignes ce que vous cherchez.'
                  : "Décrivez brièvement l'objet de votre prise de contact."
              }
              className={cn(inputClass, 'min-h-[140px] resize-y')}
              aria-invalid={Boolean(fieldErrors['message'])}
              aria-describedby={fieldErrors['message'] ? 'message-error' : undefined}
            />
            {fieldErrors['message'] ? (
              <p id="message-error" className={errorClass}>
                {fieldErrors['message'][0]}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-l-2 border-levant-500 pl-md">
          <p className="text-xs leading-relaxed text-ink-600">{rgpdText}</p>
        </div>

        <div>
          <label className="flex items-start gap-md cursor-pointer">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-1 h-5 w-5 flex-shrink-0 border-ink-300 accent-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
              aria-describedby={fieldErrors['consent'] ? 'consent-error' : undefined}
            />
            <span className="text-sm text-ink-700">
              J&apos;accepte que mes données soient traitées par ISSA Capital dans le cadre
              de cette demande, conformément à la politique de confidentialité.{' '}
              <span aria-hidden="true">*</span>
            </span>
          </label>
          {fieldErrors['consent'] ? (
            <p id="consent-error" className={errorClass}>
              {fieldErrors['consent'][0]}
            </p>
          ) : null}
        </div>

        {serverError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="border-l-2 border-reserve-500 bg-reserve-100 p-md text-sm text-reserve-700"
          >
            {serverError}
          </div>
        ) : null}

        <div className="pt-sm">
          <Button type="submit" variant="primary" size="lg" loading={status === 'submitting'}>
            {variant === 'opportunite'
              ? 'Soumettre ma proposition'
              : variant === 'accompagnement'
                ? 'Envoyer un message'
                : 'Envoyer'}
          </Button>
        </div>
      </div>
    </form>
  );
}
