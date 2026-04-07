# Copy — Page Contact
> @copywriter — 2026-04-07
> Framework : 4Ps simplifié (Promise → Push — page courte, pas de long texte)
> Niveau de conscience : Most-Aware — le visiteur a décidé de prendre contact, il cherche juste le moyen
> Source : docs/strategy/brand-platform.md + docs/legal/legal-audit.md + docs/legal/rgpd-checklist.md

---

## Résumé exécutif

- **Objectif** : offrir un point de contact direct — formulaire unique, mention RGPD obligatoire, adresse email directe
- **Décisions clés** : formulaire réutilisé du composant global (functional-specs.md), email contact@issa-capital.com affiché, ton sobre et direct
- **Dépendances** : @fullstack (composant formulaire de contact, envoi via Resend), @design (page sobre — minimum de friction)

---

## Objectif de la page

Permettre à n'importe quel visiteur — Karim, Leila, Marc, partenaire — de prendre contact facilement, sans friction.

## Personas cibles

- **Tous** : Karim (contact direct avec Thomas), Marc (demande d'entretien presse), partenaires B2B, tout visiteur qualifié

---

## Métadonnées SEO

```
Title tag (46 car.) : Contact — ISSA Capital
Meta description (127 car.) : Prenez contact avec ISSA Capital. Pour toute demande — opportunité, accompagnement ou presse — écrivez à contact@issa-capital.com.
OG title : Contact — ISSA Capital
OG description : Formulaire de contact ISSA Capital. Pour les opportunités d'affaires, utilisez la page dédiée.
```

---

## H1

### H1
Prendre contact.

---

## Section 1 — Introduction courte

### Corps
Pour toute demande — opportunité d'affaires, accompagnement, presse ou autre — vous pouvez utiliser le formulaire ci-dessous ou écrire directement à **contact@issa-capital.com**.

Pour les opportunités d'investissement immobilier ou de participation, la [page Opportunités d'affaires](/opportunites) vous permettra de qualifier votre dossier plus efficacement.

---

## Section 2 — Formulaire de contact

[Notes @fullstack : composant formulaire identique à /opportunites, variante "contact général" — heading différent, champs simplifiés. Voir functional-specs.md composants transversaux.]
[Notes @design : formulaire sobre, propre, labels au-dessus des champs.]

### H2
Formulaire de contact.

### Champs du formulaire

**Prénom et nom** *(obligatoire)*
`placeholder : Jean Dupont`

**Email** *(obligatoire)*
`placeholder : vous@votredomaine.com`

**Sujet** *(obligatoire — liste déroulante)*
Options :
- Opportunité d'affaires
- Accompagnement / conseil
- Demande presse
- Autre

**Message** *(obligatoire — champ texte libre, 1000 caractères max)*
`placeholder : Décrivez brièvement l'objet de votre prise de contact.`

### Mention RGPD (obligatoire — au-dessus du bouton)
[Texte exact issu de docs/legal/rgpd-checklist.md section 2 :]

Les informations que vous transmettez via ce formulaire sont collectées par ISSA Capital (SAS, 54 Rue Henri Barbusse, 92000 Nanterre) pour traiter votre demande ou proposition. Elles sont destinées aux dirigeants d'ISSA Capital et conservées 3 ans maximum. Vous pouvez exercer vos droits d'accès, de rectification et de suppression en écrivant à contact@issa-capital.com. Pour en savoir plus, consultez notre [politique de confidentialité](/mentions-legales#confidentialite).

### Label consentement (checkbox obligatoire)
☐ J'accepte que mes données soient traitées par ISSA Capital dans le cadre de cette demande, conformément à la politique de confidentialité.

### Bouton CTA
**« Envoyer »**

### Message de succès
Votre message a été transmis. Nous répondons aux demandes qualifiées.

### Message d'erreur — champ obligatoire vide
Ce champ est obligatoire.

### Message d'erreur — format email invalide
Vérifiez le format de votre adresse email.

### Message d'erreur — soumission échouée
Le message n'a pas pu être envoyé. Merci d'écrire directement à contact@issa-capital.com.

---

## Section 3 — Contact direct

### H2
Contact direct.

**Email** : contact@issa-capital.com

*Nous répondons aux demandes qualifiées.*

---

## Microcopy

| Élément | Texte |
|---|---|
| Fil d'Ariane | Accueil > Contact |
| Label champ Prénom/Nom | Prénom et nom |
| Label champ Email | Email |
| Label champ Sujet | Sujet |
| Label champ Message | Message |
| Lien texte vers /opportunites | page Opportunités d'affaires |

---

## Test persona — validation

**Test Karim** (entrepreneur, 30 secondes) :
Karim a lu /accompagnement et décide de prendre contact. Il arrive sur /contact, voit le formulaire en 4 champs, choisit "Accompagnement / conseil" dans le menu déroulant, rédige 3 lignes, soumet. Ou il clique directement sur l'adresse email. Sans friction. Verdict : la page fait son travail — point d'entrée minimal.

**Test Marc** (journaliste, 30 secondes) :
Marc cherche un contact presse. Il voit le formulaire avec l'option "Demande presse" et l'email direct. Il soumet ou envoie un email. Verdict : Marc a ce dont il a besoin.

---

## Auto-évaluation gates copy

- G10 PASS — aucun langage vague
- G12 PASS — formulaire spécifié avec champs, CTA, états
- G13 PASS — aucune donnée inventée
- G15 PASS — aucun placeholder résiduel
- G16 PASS — ISSA Capital cité >= 3 fois
- G24 PASS — vouvoiement systématique
- Anti-L.411-1 PASS — page de contact générique, aucun mot interdit
