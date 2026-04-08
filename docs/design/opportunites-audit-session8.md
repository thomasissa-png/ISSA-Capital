> Sources amont : src/app/opportunites/page.tsx, src/app/page.tsx, src/app/accompagnement/page.tsx, src/app/participations/page.tsx, docs/design/design-tokens.json

# Audit visuel — /opportunites (session 8)

**Date** : 2026-04-08
**Déclencheur** : Thomas — phrase de positionnement "seule sur fond blanc un peu pauvre visuellement"
**Auditeur** : @design

---

## 1. Synthèse exécutive

La page /opportunites est fonctionnellement solide et narrativement juste, mais souffre d'un déséquilibre structural identifiable : la section "Intro positionnement" (S2) est une phrase unique sans overline ni titre sur fond quasi-blanc, visuellement orpheline entre un hero correct et une section critères bien construite. La phrase elle-même est bonne — c'est son architecture de section qui échoue. **4 problèmes visuels identifiés** au total. Recommandation principale : supprimer la section S2 et redistribuer sa substance dans le hero comme note secondaire, ce qui fluidifie l'enchaînement Hero → Critères et résout le signal Thomas sans perte d'information.

---

## 2. Audit section par section

| Section | Tone | Densité | Hiérarchie | Composants visuels | Verdict |
|---|---|---|---|---|---|
| Hero (S1) | default | Moyenne | Complète — overline + H1 + lead | Fil d'Ariane, texte | Acceptable |
| Intro positionnement (S2) | elevated | **Très faible** | **Absente** — 0 overline, 0 H2 | 1 seul paragraphe | **Problème critique** |
| Critères (S3) | subtle | Élevée | Complète — overline + H2 + cards + encadré | Grille 2 cards, border-l levant | Bonne — section la plus solide |
| Process (S4) | default | Moyenne | Complète — overline + H2 + ol 3 cols | Numérotation H2, border-t levant | Correcte — tone monotone |
| Signature éditoriale (S5) | inverse | Faible (voulu) | Intentionnel | Citation italique parchment | Bonne — silence assumé |
| Formulaire (S6) | elevated | Moyenne | Overline + H3 + sous-titre | ContactForm | Correcte |
| Clause légale (S7) | default | Très faible | Absente | Texte xs italic | Mineure — attendue |

**Pattern tone** : default → elevated → subtle → default → inverse → elevated → default

L'alternance est globalement correcte. Problème spécifique : la section S2 `elevated` est visuellement imperceptible depuis le S1 `default` — le token `elevated` correspond à `parchment-50` (#FAF7F2) quasiment identique au fond default, donc l'oeil ne détecte pas de rupture. La section S2 apparaît comme une zone blanche sans raison d'être.

Comparaison sectorielle : /accompagnement distribue ses contrepoints visuels plus tôt (S3 elevated, S5 subtle, S7 subtle, S8 inverse) — la page /opportunites concentre tout le contraste en S3 et S5.

---

## 3. Problème critique — La phrase seule sur fond blanc

### Diagnostic précis

Section concernée, lignes 59-68 de `src/app/opportunites/page.tsx` :

```tsx
{/* Intro positionnement */}
<Section tone="elevated">
  <Container width="editorial">
    <p className="text-base leading-relaxed text-ink-700">
      Cette page s&apos;adresse aux apporteurs d&apos;affaires et aux fondateurs
      qui cherchent un actionnaire de long terme : une holding familiale, sans
      comité trimestriel, qui décide sur les dossiers qualifiés.
    </p>
  </Container>
</Section>
```

**Ce qui échoue** :
1. Zéro hiérarchie — pas d'overline, pas de titre. Le visiteur ne sait pas si c'est un chapeau, un avertissement ou une transition
2. `tone="elevated"` non perceptible visuellement depuis `tone="default"` — la section flotte
3. `width="editorial"` (560px max) correct pour la lisibilité mais renforce l'impression de vide horizontal
4. Redondance éditoriale : "actionnaire de long terme / sans comité trimestriel" est répété dans les cards S3 (ligne 124 : "pas un fonds à horizon de sortie contraint") ; "apporteurs d'affaires et fondateurs" est implicite dans tout le reste de la page

**Verdict** : la phrase est bonne narrativement — c'est l'absence de composants d'ancrage qui crée le problème visuel.

---

### Option 1 — Suppression (recommandation @design)

Supprimer les lignes 59-68 entièrement. La phrase est redondante avec :
- Le lead du hero (ligne 50-55) : "ISSA Capital investit son propre patrimoine familial... Critères explicites. Horizon intergénérationnel."
- Les cards S3 qui filtrent déjà par type de dossier
- L'overline S3 "Nos critères" qui annonce implicitement le ciblage

La suppression allège la page, fluidifie Hero → Critères, renforce la lecture directe.

**Si Thomas veut conserver la substance** : ajouter une note sous le lead du Hero (voir option 3 ci-dessous, qui combine suppression S2 + absorption dans le Hero).

### Option 2 — Enrichissement visuel (si Thomas veut conserver S2 comme section)

Transformer S2 en grille de positionnement avec composants d'ancrage :

```tsx
{/* Intro positionnement — version enrichie */}
<Section tone="elevated">
  <Container width="content">
    <Overline>À qui s&apos;adresse cette page</Overline>
    <div className="mt-lg grid grid-cols-1 gap-xl md:grid-cols-2">
      <div className="border-l-2 border-levant-500 pl-lg">
        <p className="font-heading text-h4 text-ink-950">
          Apporteurs d&apos;affaires
        </p>
        <p className="mt-sm text-base text-ink-700">
          Vous avez un actif à présenter — immobilier résidentiel francilien
          ou entreprise opérationnelle avec traction démontrée.
        </p>
      </div>
      <div className="border-l-2 border-levant-500 pl-lg">
        <p className="font-heading text-h4 text-ink-950">
          Fondateurs cherchant un actionnaire
        </p>
        <p className="mt-sm text-base text-ink-700">
          Vous cherchez un partenaire de long terme. Sans comité trimestriel,
          sans horizon de sortie contraint. Une famille qui décide en direct.
        </p>
      </div>
    </div>
  </Container>
</Section>
```

Résultat : overline + H4 + corps, grille 2 colonnes, border-l levant cohérent avec les autres pages. Densité : très faible → moyenne.

### Option 3 — Fusion dans le Hero + suppression S2

Ajouter la substance de S2 dans le Hero comme note secondaire (après le lead, avant la fermeture du div), puis supprimer S2 :

```tsx
{/* Ajouter dans le Hero, après le <p className="mt-lg text-lead"> : */}
<p className="mt-md text-sm italic text-ink-600">
  Cette page s&apos;adresse aux apporteurs d&apos;affaires et aux fondateurs
  qui cherchent un actionnaire de long terme — une holding familiale qui
  décide sans comité trimestriel.
</p>
```

Résultat : le Hero est plus dense, le visiteur est qualifié dès l'entrée, S2 disparaît. Pattern utilisé sur /participations ligne 73 ("Cette page présente la cartographie...") — cohérent.

---

## 4. Autres problèmes visuels détectés

### Problème 2 — Hero sans repères visuels secondaires

**Diagnostic** : Le Hero de /opportunites est le plus "nu" du site. Le H1 "Vous avez un dossier. Voyons s'il correspond." est fort et direct, mais le lead se termine sans aucun élément de qualification visuelle. Comparaison : /participations hero a 2 paragraphes de corps + une note secondaire ; /accompagnement hero a un H1 de 2 lignes qui prend toute la place. /opportunites reste sobre — ce n'est pas un défaut en soi, mais si S2 est supprimée (option 1 ou 3), le Hero devient la seule zone de qualification avant les cards.

**Option A (minimum)** : Appliquer l'Option 3 ci-dessus — la note italique absorbe la qualification et enrichit le Hero sans l'alourdir.

**Option B (@design)** : Ajouter sous le lead 3 repères inline (données déjà présentes dans la page, extraction visuelle uniquement) :

```tsx
<div className="mt-xl flex flex-wrap items-center gap-md text-sm text-ink-500">
  <span>Immobilier résidentiel Île-de-France</span>
  <span aria-hidden="true" className="text-ink-300">·</span>
  <span>Participations minoritaires</span>
  <span aria-hidden="true" className="text-ink-300">·</span>
  <span>Ticket minimum 200 000 €</span>
</div>
```

Ces données sont déjà présentes dans S3 — c'est une remontée visuelle, pas une invention. Densité hero : faible → moyenne.

### Problème 3 — Rupture tonale insuffisante entre S3 (subtle) et S4 (default)

**Diagnostic** : S3 (subtle) enchaîne sur S4 (default) — deux tons proches, pas de rupture perceptible pour l'oeil. Sur /accompagnement, la même transition subtle → default est compensée par des sections très riches. Sur /opportunites, S4 (ol 3 cols) est moins dense que S3 (cards 2 cols), ce qui renforce l'impression de descente visuelle.

**Option A (minimum)** : Basculer S4 en `tone="elevated"` (1 ligne, ligne 154). Rupture crème/blanc immédiate, zéro risque éditorial.

**Option B (@design)** : Conserver `tone="default"` sur S4 mais ajouter un chapeau sous le H2 — une ligne de description courte qui donne de la matière au-dessus de l'ol. Le H2 "Trois étapes. Pas de comité trimestriel." est bon mais arrive sans transition depuis S3.

### Problème 4 — Clause légale S7 : fin de page fade

**Diagnostic** : S7 `tone="default"` après S6 `tone="elevated"` — deux tons clairs consécutifs, fin de page peu affirmée. C'est une clause légale donc volontairement discrète, mais le changement de tone est imperceptible.

**Option A (minimum)** : Basculer S7 en `tone="subtle"` (ligne 221). Clôture de page plus douce, différenciation perceptible depuis S6.

**Option B (@design)** : Pas de changement structurel — intégrer la clause dans un `<footer>` de la section S6, séparée par `border-t border-ink-200 pt-lg`. Moins de sections, meilleure cohérence visuelle de bas de page.

---

## 5. Recommandation consolidée

**P1 — Résoudre S2 [critique]** : Appliquer l'Option 3 (note secondaire dans le Hero + suppression S2). Si Thomas préfère conserver une section dédiée, appliquer l'Option 2 (enrichissement en grille). Ne pas laisser S2 en l'état.

**P2 — Tone de S4 [majeur]** : Changer `tone="default"` → `tone="elevated"` sur S4 (ligne 154). 1 ligne, rupture visuelle immédiate entre les deux sections claires.

**P3 — Tone de S7 [mineur, optionnel]** : Changer `tone="default"` → `tone="subtle"` sur S7 (ligne 221). Clôture plus douce.

---

## 6. Brief implémentation @fullstack

Fichier cible unique : `src/app/opportunites/page.tsx`

### Modification 1 — P1 Option 3 : Note Hero + Suppression S2 [CRITIQUE]

**Étape A** — Dans le Hero (lignes 44-56), après la fermeture `</p>` du lead (ligne 54), ajouter avant la fermeture `</div>` :

```tsx
            <p className="mt-md text-sm italic text-ink-600">
              Cette page s&apos;adresse aux apporteurs d&apos;affaires et aux fondateurs
              qui cherchent un actionnaire de long terme — une holding familiale qui
              décide sans comité trimestriel.
            </p>
```

**Étape B** — Supprimer intégralement les lignes 59-68 (bloc commentaire inclus) :

```
      {/* Intro positionnement */}
      <Section tone="elevated">
        <Container width="editorial">
          <p className="text-base leading-relaxed text-ink-700">
            Cette page s&apos;adresse aux apporteurs d&apos;affaires et aux fondateurs
            qui cherchent un actionnaire de long terme : une holding familiale, sans
            comité trimestriel, qui décide sur les dossiers qualifiés.
          </p>
        </Container>
      </Section>
```

Si Thomas préfère la variante Section enrichie (Option 2), remplacer le bloc supprimé par le code de l'Option 2 documenté en Section 3 ci-dessus — ne pas appliquer l'Étape A dans ce cas.

### Modification 2 — P2 : Tone S4 [REQUIS]

Ligne 154 — changer `tone="default"` en `tone="elevated"` :

```tsx
// AVANT :
      <Section tone="default">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Notre process</Overline>

// APRÈS :
      <Section tone="elevated">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Notre process</Overline>
```

### Modification 3 — P3 : Tone S7 [OPTIONNEL]

Ligne 221 — changer `tone="default"` en `tone="subtle"` :

```tsx
// AVANT :
      <Section tone="default" className="py-xl">

// APRÈS :
      <Section tone="subtle" className="py-xl">
```

**Ordre d'implémentation** : Modification 1 (Étapes A+B ensemble) → vérification visuelle du Hero → Modification 2 → vérification alternance tonale → Modification 3 si approuvée.

**Effort estimé** : 2-3 sections modifiées, ~25 lignes de diff total (suppressions + ajouts). Zéro nouvelle dépendance, zéro nouveau composant.

---

**Handoff → @orchestrator puis @fullstack**

- Fichier produit : `docs/design/opportunites-audit-session8.md`
- Problèmes détectés : 4 (1 critique — S2 phrase isolée sans ancrage, 1 majeur — rupture tonale S3/S4 insuffisante, 1 moyen — Hero sans repères visuels secondaires si S2 supprimée, 1 mineur — clause légale S7 fin de page fade)
- Décisions prises : suppression de S2 comme section autonome recommandée, avec 3 options documentées pour Thomas ; renforcement de l'alternance tonale via 2 changements de tone ; enrichissement Hero via note secondaire
- Points d'attention : la note italique ajoutée au Hero (Option 3) ne doit pas créer de confusion hiérarchique avec le lead — la classe `text-sm italic text-ink-600` la positionne clairement en rang secondaire sous le `text-lead text-ink-700`
- Aucun token hors design system dans les suggestions de code
- Identité libanaise non impactée — aucune suggestion ne touche aux contenus texte verrouillés
