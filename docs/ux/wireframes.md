# Wireframes — ISSA Capital
> @ux — 2026-04-07
> Source : project-context.md + docs/strategy/personas.md + docs/product/functional-specs.md + docs/design/page-compositions.md
> 7 pages V1 : Accueil / Mission / Accompagnement / Opportunités / Participations / Contact / Mentions légales

---

## Règles transverses

### Navigation (Header)
- **Pattern** : barre horizontale pleine largeur, fond noir-profond (#0A0A0A), hauteur fixe 64px
- **Contenu** : logo "ISSA Capital" (gauche) + liens Mission | Participations | Accompagnement | Opportunités | Contact (centre ou droite) + CTA "Proposer une opportunité" (bouton outline levant, extrême droite)
- **Comportement scroll** : backdrop-blur + légère opacité au scroll (transition 200ms)
- **Lien actif** : couleur levant (#C4935A), pas de soulignement
- **Responsive 375px** : logo + hamburger uniquement. Menu déroulant pleine largeur avec liens empilés + CTA en bas
- **Responsive 768px** : liens raccourcis, CTA réduit à icône ou libellé court
- **Accessibilité** : focus-visible levant sur tous les liens, keyboard nav complète, aria-label="Navigation principale", aria-current="page" sur lien actif
- **CTA absent sur** : page Contact, page Opportunités (redondant avec formulaire visible)

### Footer
- **Pattern** : fond noir-profond, padding 48px vertical, stack vertical centré
- **Contenu** : nom + forme juridique + SIREN + adresse | liens secondaires | © {année dynamique} ISSA Capital
- **Responsive** : identique à toutes résolutions (stack vertical — déjà condensé)

### Typographie globale
- Headings H1-H2 : Cormorant Garamond, poids 400-600, noir (#0A0A0A) sur crème (#F5F0E8) ou blanc sur noir
- Corps : Inter, 16px/1.6, gris-foncé (#2C2C2C) sur fond crème
- Liens inline : levant (#C4935A), pas de soulignement par défaut, soulignement au hover

### États UI transversaux
- **Loading** : font-display: swap — texte visible avec police système en fallback
- **Erreur 404** : page dédiée avec H1 sobre + lien retour Accueil
- **Reduced-motion** : toutes les transitions CSS enveloppées dans `@media (prefers-reduced-motion: reduce)` — transitions désactivées, états finaux directs

---

## Index des 7 pages

| # | URL | Persona cible | CTA principal | Description courte |
|---|-----|---------------|---------------|--------------------|
| 1 | `/` | Karim + Leila (premier contact) | "Proposer une opportunité" → /opportunites | Identité, mission courte, écosystème aperçu, bifurcation 2 CTAs |
| 2 | `/mission` | Marc + Karim | "Échanger sur votre projet" → /accompagnement | Histoire famille Issa, convictions, filtres de décision, vision 30 ans |
| 3 | `/accompagnement` | Karim | "Prendre contact" → /contact | Expertise Thomas, domaines, formats mission/advisoring |
| 4 | `/opportunites` | Leila | Formulaire 7 champs | Critères d'investissement, formulaire de soumission qualifiant |
| 5 | `/participations` | Leila + Marc | "Proposer une opportunité" → /opportunites | Écosystème 2 niveaux, présentation 6 entités |
| 6 | `/contact` | Marc + Karim | Email direct | Formulaire court 4 champs, email visible |
| 7 | `/mentions-legales` | Marc (vérification légale) | — | Mentions légales + politique de confidentialité |

---

<!-- SECTIONS COMPLÈTES À AJOUTER VIA EDIT -->
