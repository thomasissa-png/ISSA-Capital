# Product Vision — ISSA Capital
> @product-manager — 2026-04-07
> Source : project-context.md (validé Phase 0 par Thomas)
> Livrables amont manquants : brand-platform.md, personas.md (Phase 0 production non encore livrée) — travail effectué depuis project-context.md [PROVISOIRE — à re-valider quand brand-platform.md et personas.md seront disponibles]

---

## Résumé exécutif

- **Objectif** : Définir la vision produit du site vitrine ISSA Capital — ce qu'il fait, ce qu'il ne fait pas, et comment on mesure son succès
- **Décisions clés** : Site vitrine institutionnel pur (zéro transactionnel), CTA unique convergent vers formulaire d'opportunité, 6 pages V1 verrouillées
- **Dépendances** : @ux (parcours et wireframes), @design (design system), @copywriter (textes), @data-analyst (tracking-plan)

---

## 1. Problème

ISSA Capital est une holding patrimoniale familiale libanaise constituée en SAS française (Nanterre, mars 2026). Elle pilote un écosystème de 6 entités (Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, immobilier en direct). Aujourd'hui, son empreinte numérique publique est quasi inexistante : le site actuel bloque les bots, aucun contenu structuré n'est accessible, et les seuls points d'entrée sont le profil LinkedIn personnel de Thomas Issa et des recherches Google fragmentaires.

Ce déficit de visibilité crée trois problèmes concrets :

1. **Hélène** (fondatrice de PME cherchant un adossement long-terme) ne peut pas identifier ISSA Capital comme alternative sérieuse aux fonds LBO. Faute de site lisible, elle ne sait pas que la holding existe, ce qu'elle investit, ni comment la contacter.
2. **Sophie** (partenaire B2B — banquier, avocat M&A) n'a aucun point d'entrée structuré pour évaluer ISSA Capital ou l'orienter à un client. La crédibilité institutionnelle est insuffisante pour une mise en relation professionnelle.
3. **Marc** (journaliste / analyste) ne trouve aucune information publique fiable sur l'écosystème ISSA Capital pour rédiger une note ou un article.

Le problème à résoudre en V1 : absence de crédibilité institutionnelle en ligne + absence de pipeline d'opportunités entrant structuré.

---

## 2. Vision produit

ISSA Capital.com devient la **vitrine institutionnelle de référence** de la holding familiale libanaise — un point d'entrée unique, sobre et crédible, qui :

- Pose l'identité de la holding (famille libanaise, horizon intergénérationnel, filtres de décision non négociables)
- Présente l'écosystème de participations de manière structurée et intelligible
- Génère un flux entrant de propositions d'investissement qualifiées via un formulaire unique
- Donne aux partenaires B2B un support de référence qu'ils peuvent transmettre à leurs clients

Le site n'est pas un outil de vente, ni un blog, ni un portail investisseur. C'est une **carte de visite institutionnelle de niveau holding patrimoniale européenne haut de gamme** — pensé pour durer 10 ans sans être daté.

---

## 3. Audience prioritaire

### Persona principal — Hélène, 54 ans, fondatrice de PME (validé Phase 0)

Fondatrice d'une PME française (secteur services, industrie légère ou B2B), cherchant à céder ou à être adossée à une structure patrimoniale long-terme. Elle refuse les fonds LBO court-termistes qui revendent dans 5 ans. Elle cherche un partenaire qui comprend que son entreprise est son oeuvre, pas un actif à dépecer.

**Ce qu'elle cherche sur le site :** comprendre QUI est ISSA Capital, POURQUOI la famille Issa investit (horizon et valeurs), QUELS types de projets ils ont déjà et SI elle peut proposer sa boîte.

**Ce qui la fera fuir :** un site corporate vide, un discours LBO standard, un formulaire de contact générique sans signal que sa candidature sera lue.

### Persona secondaire — Sophie, 45 ans, partenaire B2B

Banquier privé, avocat d'affaires ou conseiller M&A. Elle a besoin de comprendre la structure en 3 minutes pour décider si ISSA est pertinent pour un client ou un mandat.

### Persona tertiaire — Marc, 38 ans, journaliste / analyste

Cherche à comprendre l'écosystème ISSA Capital pour une note, un article ou un profil d'investisseur.

[PROVISOIRE — les personas seront confirmés et enrichis par @creative-strategy dans personas.md]

---

## 4. Ce que le site DOIT faire — 6 promesses fonctionnelles

1. **Poser l'identité en 10 secondes** : dès la page d'accueil, un visiteur inconnu comprend que ISSA Capital est une holding patrimoniale d'une famille libanaise, qu'elle investit long-terme, et ce qu'elle cherche.

2. **Crédibiliser l'écosystème** : la page Participations présente les 6 entités de manière structurée, avec leurs secteurs, leurs positionnements et leurs liens — même pour les entités non documentées publiquement (Gradient One, Versi Immobilier, Versi Invest, immobilier en direct). [HYPOTHÈSE : contenu des participations non documentées sera fourni par Thomas en Phase 1]

3. **Expliquer les critères d'investissement** : la page Opportunités dit clairement ce qu'ISSA cherche (secteur, horizon, taille), ce qu'elle refuse (logique court-termiste, secteurs contraires à ses filtres éthiques), et comment proposer.

4. **Collecter des propositions qualifiées** : le formulaire de contact (page Opportunités et page Contact) collecte les informations minimales nécessaires pour qualifier une proposition : nom, entreprise, secteur, taille, motivations. Chaque soumission est envoyée par email à Thomas via Resend (ou équivalent).

5. **Assurer la conformité légale** : mentions légales conformes (SAS, SIREN, siège), politique de confidentialité RGPD, gestion des cookies (Plausible = pas de cookies tiers → bandeau simplifié).

6. **Être indexable et trouvable** : structure HTML sémantique, métadonnées SEO par page, temps de chargement <2s — pour que Hélène ou Sophie puissent trouver ISSA Capital en recherchant "holding patrimoniale familiale investissement long terme PME".

---

## 5. Ce que le site NE DOIT PAS faire — Anti-features

Ces éléments sont explicitement hors scope V1. Toute demande d'ajout de l'une de ces features doit être challengée contre le KPI North Star avant acceptation.

| Anti-feature | Raison d'exclusion |
|---|---|
| Blog / articles de contenu | Hors périmètre V1 (validé par Thomas H11). Risque : contenu générique qui dilue le positionnement institutionnel sobre |
| Espace investisseur authentifié | Pas d'appel public à l'épargne, pas d'agrément AMF. Hors besoin V1. |
| Chatbot / messagerie live | Incompatible avec le ton premium sobre. Le formulaire suffit. |
| Multi-langue (EN, AR) | V1 FR uniquement (validé H12). Anglais et arabe différés à V2 si la holding s'internationalise. |
| Newsletter / liste email | Hors scope V1. Aucun contenu récurrent à distribuer en V1 (pas de blog). |
| Fil de presse / communiqués | Complexifie la maintenance. Holding jeune sans communiqués publiés en V1. |
| Témoignages / avis partenaires | Pas de témoignages disponibles en mars 2026 (holding créée en 2026). À ajouter en V2 si disponibles. |
| Tableau de bord portfolio en temps réel | Hors scope V1. Site vitrine, pas de plateforme de reporting investisseur. |
| Version mobile-first dégradée | Le site est responsive par design (Tailwind) — il n'y a pas de version dégradée, il y a une version mobile premium. |
| Animations lourdes / vidéo background | Incompatible avec le ton intemporel sobre et le budget 0€ vidéo. |

---

## 6. KPI North Star et critères de succès post-launch

### KPI North Star (validé Phase 0 — H5)

**Nombre de demandes de contact qualifiées via formulaire / mois**

Formule : soumissions formulaire Opportunités ou Contact avec champs obligatoires remplis ET objet mentionnant "investissement" / "participation" / "proposition".

Seuil d'alerte : <2 demandes qualifiées/mois dans les 3 premiers mois après lancement.
Seuil de succès : ≥5 demandes qualifiées/mois à M+3.

### KPI secondaire (validé Phase 0 — H6)

**Perception de crédibilité institutionnelle**

Mesure : 3 à 5 retours qualitatifs de partenaires (banquier, avocat, conseiller) sollicités après lancement. Critère binaire : "ce site suffirait-il pour présenter ISSA Capital à un client ?" → oui/non.

Seuil de succès : 4/5 retours positifs.

### Métriques Plausible (input metrics)

| Métrique | Description | Seuil d'alerte |
|---|---|---|
| Taux de rebond page Accueil | % visiteurs qui repartent sans cliquer | >70% à M+1 |
| Taux de conversion Accueil → Opportunités | % visiteurs qui cliquent vers la page Opportunités | <10% à M+1 |
| Taux de soumission formulaire | % visiteurs page Opportunités qui soumettent | <5% à M+1 |
| Pages/session | Nombre moyen de pages consultées par visite | <1.8 à M+1 |
| Sources de trafic | Répartition direct/organique/social | À documenter dès M+1 |

[PROVISOIRE — seuils à affiner par @data-analyst dans kpi-framework.md]

---

## 7. Risques produit et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Contenu des participations non documentées (Gradient One, Versi Immo, Versi Invest, immo en direct) pas fourni à temps | Élevée | Bloquant sur page Participations | Préparer un placeholder rédactionnel sobre "En cours de structuration" pour les entités non documentées, en attente des données Thomas. Ne jamais inventer de description. |
| Ton trop corporate / générique qui ne se distingue pas d'une holding classique | Moyenne | Fort (dilue le positionnement libanais familial unique) | @copywriter lit les 3 mots de marque (Famille / Transmission / Long-terme) ET l'identité libanaise avant de rédiger. Chaque texte est testé : "peut-on coller ce texte sur le site d'une autre holding ?" Si oui → à réécrire. |
| Formulaire de contact trop simple → propositions non qualifiées | Moyenne | Moyen (coût de traitement pour Thomas) | Formulaire Opportunités avec champs spécifiques (secteur, taille, horizon de cession) — voir US-10 et US-11. |
| Hébergement Replit en V1 : temps de réponse dégradé ou downtime | Faible | Fort sur crédibilité | @infrastructure surveille les performances post-lancement. Basculement vers Vercel possible en V2 si nécessaire. |
| RGPD : formulaire de contact sans consentement explicite | Faible (site FR uniquement) | Moyen (conformité) | @legal valide la politique de confidentialité et le bandeau cookies avant lancement. Plausible = sans cookies → bandeau simplifié. |
| SEO : domaine issa-capital.com avec historique inconnu | Faible | Faible à court terme | @seo audite le domaine en Phase 3. Si pénalité → stratégie de décontamination. |

---

## 8. Positionnement produit vs alternatives

| Alternative actuelle | Limite pour Hélène | Ce que le site ISSA résout |
|---|---|---|
| LinkedIn Thomas Issa | Profil personnel, pas institutionnel. Pas de présentation des participations. Pas de formulaire dédié. | Un site institutionnel avec présentation structurée de l'écosystème ET formulaire de proposition dédié |
| Recherche Google "ISSA Capital" | Résultats fragmentaires (societe.com, Infogreffe). Aucune narration de marque. | Une page d'accueil indexée qui raconte la mission et les valeurs |
| Fonds LBO traditionnels | Horizon court (5-7 ans), pas de valeurs familiales, exit obligatoire | Holding familiale avec horizon intergénérationnel explicite et filtres éthiques documentés |

---

## Hypothèses à valider

| # | Hypothèse | Test de validation | Statut |
|---|---|---|---|
| A1 | Le contenu des participations non documentées (Gradient One, Versi Immo, Versi Invest, immo direct) sera fourni par Thomas avant la Phase 2 (dev) | Thomas valide les descriptions lors du handoff @copywriter | À valider |
| A2 | Hélène cherche activement des holdings patrimoniales en ligne (et non via réseaux uniquement) | À valider par @creative-strategy en interviews discovery | À valider |
| A3 | Le formulaire avec 5-6 champs (vs formulaire générique 3 champs) ne décourage pas les soumissions | A/B test possible en V2. En V1 : partir du formulaire qualifiant. | À valider post-launch |
| A4 | Plausible self-hosted ou plan minimal couvre les besoins analytics sans dépasser le budget 0€ analytics | @data-analyst valide dans kpi-framework.md | À valider |

---

**Handoff → @ux + @design + @copywriter (en parallèle)**
- Fichiers produits : `docs/product/product-vision.md`
- Décisions prises : Vision institutionnelle pure, 6 promesses fonctionnelles, 10 anti-features documentées, KPI North Star = demandes qualifiées/mois
- Points d'attention :
  - Persona principal Hélène : le site doit la convaincre en 10 secondes que ISSA n'est pas un fonds LBO
  - L'identité libanaise est un asset différenciant à mettre en scène, pas à masquer
  - Formulaire Opportunités = pièce maîtresse du site. @ux doit le concevoir pour qualifier sans décourager
  - Contenu Participations partiellement inconnu → @copywriter doit anticiper des placeholders sobres en attente de Thomas
