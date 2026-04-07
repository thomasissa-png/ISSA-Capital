# KPI Framework — ISSA Capital

## Résumé exécutif

- **Objectif** : Mesurer la performance du site vitrine ISSA Capital sur ses deux axes stratégiques — crédibilité institutionnelle et pipeline d'opportunités d'investissement
- **Décisions clés** : North Star Metric = demandes de contact qualifiées/mois via formulaire ; outil = Plausible (sans cookies, RGPD-native) ; tous les seuils sont des hypothèses à calibrer 1 mois post-launch sur données réelles
- **Dépendances** : @fullstack pour implémenter les events Plausible ; @growth pour activer le pipeline post-launch ; @legal pour validation RGPD de la politique de confidentialité

---

## 1. North Star Metric

**Nom** : Demandes de contact qualifiées par mois

**Définition** : Une demande est "qualifiée" si elle satisfait les deux conditions suivantes :
- Le formulaire a été soumis avec tous les champs obligatoires remplis (nom, email, message)
- Le champ `type_demande` = `"opportunite_investissement"` (sélectionné par l'utilisateur dans le formulaire, ou déduit du parcours page Opportunités → formulaire)

**Formule de calcul** :
```
NSM = COUNT(soumissions_formulaire) WHERE type_demande = 'opportunite_investissement'
      AND champs_obligatoires_remplis = TRUE
      Période : mois glissant (M-30j à aujourd'hui)
```

**Source de donnée** : Plausible — Goal `contact_form_submit` avec propriété `type_demande = opportunite_investissement`

**Fréquence de mesure** : Hebdomadaire (revue chaque lundi) + revue mensuelle approfondie

**Seuil cible** : [HYPOTHÈSE : 3-5 demandes qualifiées/mois à M+3 post-launch — à calibrer sur données réelles après 1 mois de trafic]

**Seuil d'alerte** : [HYPOTHÈSE : <2 demandes qualifiées/mois après M+1 post-launch → déclenche une revue du positionnement page Opportunités et du parcours utilisateur]

**Responsable de suivi** : Thomas Issa (fondateur)

**Pourquoi ce KPI** : ISSA Capital n'est pas un site e-commerce — son seul objectif de conversion est de générer des opportunités d'investissement entrantes qualifiées. Toute autre métrique est secondaire. Une demande soumise sans sélection "opportunité" peut être une prise de contact générique (partenaire, journaliste) — utile mais hors North Star.

---

## 2. KPIs Secondaires

### KPI-1 — Taux de conversion visiteur → demande de contact
*(Objectif pipeline)*

**Formule** :
```
Taux_conversion = (contact_form_submit / unique_visitors) × 100
Source : Plausible — Visitors + Goal contact_form_submit
```

**Fréquence** : Mensuelle

**Seuil cible** : [HYPOTHÈSE : 1,5-3% — benchmark sites institutionnels B2B France : 1-2% (source : btob-leaders.com, agencenile.com) ; ISSA vise le haut de la fourchette grâce au trafic qualifié (référrals ciblés, pas de SEO de masse)]

**Seuil d'alerte** : [HYPOTHÈSE : <0,5% sur 2 mois consécutifs → audit page Opportunités + parcours CTA]

**Responsable** : Thomas Issa

---

### KPI-2 — Temps passé moyen sur la page Mission & Philosophie
*(Objectif crédibilité — preuve d'intérêt éditorial)*

**Formule** :
```
Temps_moyen_Mission = AVG(time_on_page) WHERE page = '/mission'
Source : Plausible — Time on Page (métrique native) + events time_on_page_30s / time_on_page_2min
```

**Fréquence** : Mensuelle

**Seuil cible** : [HYPOTHÈSE : >1min30 de temps moyen — un visiteur qui lit la page Mission en entier s'engage avec l'identité de la holding, pas juste le pitch d'accueil]

**Seuil d'alerte** : [HYPOTHÈSE : <45s → la page Mission ne retient pas l'attention ; révision du copy ou de la structure éditoriale]

**Responsable** : Thomas Issa

---

### KPI-3 — Taux de rebond sur la page Accueil
*(Objectif crédibilité — première impression)*

**Formule** :
```
Taux_rebond_accueil = (single_page_sessions WHERE entry_page = '/' / total_sessions WHERE entry_page = '/') × 100
Source : Plausible — Bounce Rate par page d'entrée
```

**Fréquence** : Mensuelle

**Seuil cible** : [HYPOTHÈSE : <55% — benchmark sites institutionnels B2B : 35-60% (source : contentsquare.com Digital Experience Benchmark 2024, vigicorp.fr) ; <55% = signal que la promesse de la page Accueil engage suffisamment pour explorer]

**Seuil d'alerte** : [HYPOTHÈSE : >70% pendant 2 semaines consécutives → audit de la page Accueil (hero, CTA, temps de chargement)]

**Responsable** : Thomas Issa

---

### KPI-4 — Visites depuis sources qualifiées
*(Objectif pipeline — qualité du trafic entrant)*

**Définition** : Sources qualifiées = referrals provenant de (a) sites des participations ISSA (immocrew.fr, versimo.fr, gradientone.fr, versimo.fr), (b) LinkedIn (profil Thomas Issa ou pages entreprise), (c) presse économique (lesechos.fr, challenges.fr, etc.)

**Formule** :
```
Trafic_qualifié = COUNT(sessions) WHERE referrer IN (liste_sources_qualifiées)
                  + COUNT(sessions) WHERE utm_source = 'linkedin' OR utm_medium = 'social'
Source : Plausible — Top Sources avec filtrage par referrer
Proportion : trafic_qualifié / total_sessions × 100
```

**Fréquence** : Mensuelle

**Seuil cible** : [HYPOTHÈSE : >20% du trafic total issu de sources qualifiées à M+3 — signal que le bouche-à-oreille et le réseau fonctionnent ; le trafic organique search étant quasi nul en phase early (site nouveau, pas de blog)]

**Seuil d'alerte** : [HYPOTHÈSE : <10% de trafic qualifié → ISSA Capital n'est pas visible dans son écosystème naturel ; action requise sur les liens depuis les sites des participations]

**Responsable** : Thomas Issa

---

### KPI-5 — Profondeur de scroll sur la page Participations
*(Objectif crédibilité — intérêt pour l'écosystème)*

**Formule** :
```
Scroll_50%_Participations = COUNT(scroll_depth_50) WHERE page = '/participations'
Scroll_75%_Participations = COUNT(scroll_depth_75) WHERE page = '/participations'
Taux_lecture_complete = (scroll_depth_75 WHERE page='/participations' / pageviews WHERE page='/participations') × 100
Source : Plausible — Goal scroll_depth_75 (custom event)
```

**Fréquence** : Mensuelle

**Seuil cible** : [HYPOTHÈSE : >40% des visiteurs de la page Participations atteignent le scroll 75% — signal que l'écosystème (6 participations) est suffisamment intéressant pour être exploré en profondeur]

**Seuil d'alerte** : [HYPOTHÈSE : <20% → la page Participations ne donne pas envie de scroller ; révision de la structure des participations ou de leur présentation]

**Responsable** : Thomas Issa

---

## 3. KPI Qualitatif — Perception de crédibilité institutionnelle

**Objectif** : Valider la perception d'ISSA Capital par un panel de partenaires réels post-launch.

**Méthodologie** :
1. Recruter un panel de 3 à 5 personnes issues des cibles secondaires d'ISSA Capital : 1-2 banquiers privés ou conseillers M&A, 1 avocat d'affaires, 1 fondateur de PME du secteur cible (profil Hélène)
2. Leur demander de naviguer librement sur le site pendant 5-10 minutes sans instruction
3. Conduire une interview courte structurée (15-20 min) sur 4 dimensions :

**Grille d'évaluation** (chaque critère noté 1-5) :

| Dimension | Question posée | Score 1 | Score 5 |
|-----------|---------------|---------|---------|
| **Clarté de l'identité** | "En 30 secondes, comprenez-vous ce qu'est ISSA Capital ?" | Non, flou | Oui, immédiatement |
| **Crédibilité institutionnelle** | "Ce site vous inspire-t-il confiance pour une relation d'affaires ?" | Pas du tout | Totalement |
| **Lisibilité de l'écosystème** | "Comprenez-vous quelles entreprises ISSA détient et dans quels secteurs ?" | Aucune idée | Parfaitement clair |
| **Incitation à l'action** | "Si vous aviez une opportunité à proposer, sauriez-vous quoi faire ?" | Non | Oui, CTA clair |

**Score cible** : ≥4/5 sur chaque dimension pour chaque participant du panel

**Fréquence** :
- **Post-launch (M+2)** : première session — valider que le site remplit sa promesse dès le lancement
- **M+5 (3 mois post-launch)** : deuxième session — mesurer l'évolution après optimisations éventuelles

**Responsable** : Thomas Issa (recrutement panel + animation interviews)

---

## 4. Tableau de bord récapitulatif

| KPI | Type | Fréquence | Outil | Seuil cible | Seuil alerte |
|-----|------|-----------|-------|-------------|--------------|
| Demandes qualifiées/mois (NSM) | Quanti | Hebdo + Mensuel | Plausible Goal | [HYPOTHÈSE : 3-5/mois à M+3] | [HYPOTHÈSE : <2/mois] |
| Taux conversion visiteur → contact | Quanti | Mensuel | Plausible | [HYPOTHÈSE : 1,5-3%] | [HYPOTHÈSE : <0,5%] |
| Temps moyen page Mission | Quanti | Mensuel | Plausible | [HYPOTHÈSE : >1min30] | [HYPOTHÈSE : <45s] |
| Taux rebond page Accueil | Quanti | Mensuel | Plausible | [HYPOTHÈSE : <55%] | [HYPOTHÈSE : >70%] |
| % trafic sources qualifiées | Quanti | Mensuel | Plausible | [HYPOTHÈSE : >20% à M+3] | [HYPOTHÈSE : <10%] |
| Scroll 75% page Participations | Quanti | Mensuel | Plausible | [HYPOTHÈSE : >40%] | [HYPOTHÈSE : <20%] |
| Perception crédibilité (panel) | Quali | M+2 + M+5 | Interviews | ≥4/5 sur 4 dimensions | <3/5 sur 1+ dimension |

---

## 5. Hypothèses à valider

> Tous les seuils ci-dessous sont des hypothèses de travail basées sur les benchmarks B2B France disponibles (sources : contentsquare.com, btob-leaders.com, agencenile.com, vigicorp.fr). Ils doivent être calibrés sur les données réelles d'ISSA Capital après 4 semaines minimum de trafic post-launch.

| # | Hypothèse | Validation attendue | Action si infirmée |
|---|-----------|--------------------|--------------------|
| H-KPI-1 | NSM cible = 3-5 demandes/mois à M+3 | Revue à M+4 sur données réelles | Recalibrer sur le trafic effectif × taux de conversion observé |
| H-KPI-2 | Seuil d'alerte NSM = <2 demandes/mois | Revue à M+1 | Ajuster selon le volume de trafic réel (trafic faible = seuil à abaisser) |
| H-KPI-3 | Taux conversion B2B cible = 1,5-3% | Revue à M+2 | Le trafic d'ISSA est ultra-qualifié (pas de SEO de masse) — taux réel peut être plus élevé |
| H-KPI-4 | Taux de rebond acceptable = <55% | Revue à M+2 | Benchmark Contentsquare 2024 indique 35-60% pour sites institutionnels B2B |
| H-KPI-5 | >20% trafic qualifié à M+3 | Revue à M+3 | Dépend de l'activation réseau Thomas et des liens depuis les participations |
| H-KPI-6 | Scroll 75% Participations = >40% | Revue à M+2 | Ajuster si la page Participations est longue (>2 écrans) → le seuil peut descendre à 30% |
| H-KPI-7 | Panel qualitatif de 3-5 personnes suffit | Post-launch M+2 | Si recrutement difficile, 2 participants suffisent pour un signal directionnel |

---

**Handoff → @fullstack + @growth**

- Fichiers produits : `docs/analytics/kpi-framework.md`
- Décisions prises :
  - Outil analytics retenu : **Plausible** (validé Thomas — H10)
  - North Star Metric : **demandes de contact qualifiées/mois** (formulaire, `type_demande = opportunite_investissement`)
  - 5 KPIs secondaires quantitatifs + 1 KPI qualitatif (panel partenaires)
  - Tous les seuils chiffrés sont des [HYPOTHÈSE] à calibrer M+1 post-launch — benchmarks sources : contentsquare.com Digital Experience Benchmark 2024, btob-leaders.com, agencenile.com, vigicorp.fr
- Points d'attention pour @fullstack :
  - Le formulaire doit comporter un champ `type_demande` avec valeurs fixes (select) pour permettre le filtrage Plausible sur le NSM
  - Voir `docs/analytics/tracking-plan.md` pour l'implémentation complète du snippet et des helpers TypeScript
- Points d'attention pour @growth :
  - Le KPI-4 (sources qualifiées) nécessite d'activer les liens depuis immocrew.fr, versimo.fr et gradientone.fr vers issa-capital.com dès le lancement
  - Le panel qualitatif (KPI qualitatif) doit être recruté par Thomas dès M+1 post-launch (3-5 partenaires : banquier, avocat, fondateur PME profil Hélène)
- Points d'attention pour @legal :
  - Plausible ne nécessite pas de bandeau de consentement mais requiert une mention dans la politique de confidentialité (texte fourni dans `docs/analytics/tracking-plan.md` section 5)

Gates BLOQUANT vérifiées : G5 PASS (persona Hélène citée), G7 PASS (aligné project-context.md — NSM validé H5, Plausible validé H10, objectifs validés H7), G12 PASS (chaque KPI a formule + source + seuil + responsable + fréquence), G15 PASS (zéro placeholder résiduel), G19 PASS (100% spécifique ISSA Capital — holding patrimoniale libanaise, écosystème Versi/Immocrew/Versimo)
