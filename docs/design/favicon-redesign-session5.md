> Sources amont : docs/design/design-system.md, docs/design/design-tokens.json, docs/design/assets-handoff.md, docs/strategy/brand-platform.md, public/favicon-source.svg, public/logo-monogram.svg

# Refonte favicon ISSA Capital — Session 5

---

## Diagnostic du favicon actuel

**Retour Thomas (verbatim)** : "un commentaire pour le favicon et icones : je ne suis pas tres fan, on dirait le I et le C est ecrit par un enfant sur paint. Peut on avoir un peu plus élégant ?"

**Analyse technique de la cause** : le fichier `favicon-source.svg` actuel construit le "C" exclusivement avec des rectangles empilés (barres horizontales + fût vertical + deux encoches rectangulaires de creusement). La lettre obtenue n'a aucune courbe — l'ouverture du C ressemble à un crochet rectangulaire `[`. À 16px et 32px, ce défaut est amplifié : la lettre perd toute identité typographique et paraît construite à la main avec des outils de dessin basiques.

Le "I" est techniquement correct (fût + deux empattements horizontaux) mais les proportions — empattements larges et fût court — donnent un aspect lourd, peu raffiné.

Le filet ocre levantin en bas est la seule réussite : c'est la signature graphique à conserver absolument.

**Problème de fond** : un monogramme premium ne peut pas être construit avec des rectangles seuls. Les lettres serif exigent des courbes réelles (arcs SVG ou paths). Sans `<path>` avec courbes de Bézier, aucun sérif digne de ce nom n'est reproductible.

---

## 3 concepts explorés

### Direction A — Sérif classique purs

Deux lettres indépendantes, I à gauche et C à droite, chacune dessinée en sérif authentique avec `<path>` Bézier. Le I emprunté à l'anatomie d'un Garamond romain — empattements fins, fût élégant, proportions optiques. Le C en arc véritable — barre supérieure inclinée à l'entrante, barre inférieure légèrement remontée (ouverture du C à 10h-16h), épaisseur de trait modulée (plein côté gauche, délié aux extrémités).

Fond ink-950. Glyphes parchment-100. Filet levant-500 en bas, maintenu comme signature.

Avantage : lisibilité absolue à toutes tailles (les deux lettres sont identifiables instantanément). Référence directe à EB Garamond, la typographie heading du site. Cohérence système maximale.
Inconvénient : deux lettres côte à côte demandent un viewBox large — à 16px la compacité est limitée.

### Direction B — Lettrine ligaturée (fusion I + C)

Le I et le C sont fusionnés en une forme unique : la barre verticale gauche du C est remplacée par le fût du I, les deux lettres partageant cet axe vertical commun. Le C enveloppe la droite, le I est la colonne de gauche. La lecture est "IC" mais la forme est une seule entité graphique.

Fond ink-950. Forme crème unique. Filet ocre en bas ou intégré comme branche terminale du C.

Avantage : compacité maximale, silhouette distinctive à 16px (forme d'écusson asymétrique mémorable), originalité forte.
Inconvénient : la fusion peut nuire à la lisibilité des deux lettres séparément — risque que l'on ne lise que "C" ou un glyphe abstrait. Plus complexe à calibrer optiquement.

### Direction C — Monogramme cadré (écusson)

"IC" dans un carré ou cercle, lettres centrées, espacement généreux, un filet-bordure fin en levant-500 pour délimiter le cadre. Style écusson orfèvre, sceau de famille, marque de propriété gravée.

Fond parchment-100 (inversé par rapport à l'actuel). Lettres ink-950. Bordure levant-500.

Avantage : look institutionnel affirmé, différenciation par rapport à 95% des favicons qui utilisent le fond sombre.
Inconvénient : le fond clair rend le favicon peu visible sur les onglets de navigateur (fond blanc des onglets = peu de contraste). Perd de l'impact en contexte réel d'utilisation.

---

## Concept retenu — Direction A : Sérif classique purs

**Justification** : La Direction A est la plus alignée avec les trois principes fondateurs d'ISSA Capital — Simplicité > Démonstration > Élégance.

Le I et le C en sérif authentique referment la boucle avec EB Garamond, choisi par Thomas comme typographie heading du site. Le favicon devient alors la version comprimée du système typographique du site — non pas une identité séparée, mais la même identité réduite à sa plus petite expression.

La construction par `<path>` avec courbes de Bézier résout précisément le problème soulevé par Thomas : les lettres auront une anatomie typographique réelle, pas des rectangles assemblés. Le C aura une vraie courbe — la différence est visible même à 16px.

Le fond ink-950 est maintenu (cohérence avec l'existant, contraste optimal sur onglet navigateur). Le filet levant-500 est maintenu (signature graphique du système, continuité inter-sessions).

La Direction B (ligature) a été écartée car la fusion risque de rendre illisibles les deux lettres à 16px — or la lisibilité à petite taille est le critère numéro 1 d'un favicon. La Direction C (fond clair) a été écartée pour les raisons de contraste sur onglet navigateur.

---

## Spécifications techniques

### Format SVG source

- `viewBox="0 0 512 512"` — haute résolution source, marges généreuses pour rendu propre à toutes tailles
- Fond : `<rect>` plein fond ink-950 `#0A0A0A`
- Glyphes : `<path>` curves Bézier, parchment-100 `#F5F0E8`
- Accent : `<rect>` filet horizontal 16px de haut, levant-500 `#C4935A`, positionné 24px du bas
- Aucune dépendance externe (pas de `<use>`, pas de `<symbol>`, pas de clipPath superflus)

### Couleurs — références tokens

| Rôle | Token | Valeur hex |
|---|---|---|
| Fond | `primitive.color.ink.950` | `#0A0A0A` |
| Glyphes IC | `primitive.color.parchment.100` | `#F5F0E8` |
| Filet accent | `primitive.color.levant.500` | `#C4935A` |

### Typographie du monogramme

- Inspiration : EB Garamond roman (la typographie heading du site)
- Caractéristiques fidèles : empattements fins (serif triangulaires), modulation plein/délié, axe d'inclinaison légèrement optique
- Le I : hauteur de capitale ~288px sur viewBox 512, fût de ~44px, empattements à 32px de haut et 12px de saillie de chaque côté
- Le C : arc de cercle extérieur rayon ~136px, arc intérieur rayon ~92px, ouverture à 10h30–16h30 (45° d'ouverture), empattements aux terminaisons supérieure et inférieure

### Zone de sécurité et marges

- Marge extérieure : 48px sur les 4 côtés (viewBox 512 → zone utile 416×416)
- Espacement I/C : 48px entre la terminaison droite du I et la terminaison gauche du C
- Filet ocre : x=48, largeur=416, hauteur=16, y=440 (24px au-dessus du bord bas)

### Comportement aux petites tailles

- 512×512 : version complète, tous les détails visibles
- 192×192 : lisible, empattements visibles
- 32×32 : les deux lettres sont identifiables, le filet ocre reste visible
- 16×16 : à cette résolution les empattements fins disparaissent partiellement — la silhouette globale "I C" reste reconnaisssable. Aucune simplification alternative n'est nécessaire : le design est suffisamment robuste.

---

## Handoff @fullstack

### Fichiers à régénérer

Le fichier `public/favicon.svg` est la nouvelle source unique. L'ancien `public/favicon-source.svg` doit être mis à jour avec le même SVG (ou remplacé par un pointeur vers favicon.svg).

| Fichier | Action | Source |
|---|---|---|
| `public/favicon.svg` | Remplacé — nouvelle version | Ce livrable |
| `public/favicon-source.svg` | Remplacer le contenu par le même SVG (cohérence) | Ce livrable |
| `public/favicon.ico` | Régénérer via `scripts/generate-assets.mjs` | favicon-source.svg 16/32/48 |
| `public/favicon-16.png` | Régénérer | favicon-source.svg |
| `public/favicon-32.png` | Régénérer | favicon-source.svg |
| `public/icon-192.png` | Régénérer (anciennement android-chrome-192x192) | favicon-source.svg |
| `public/icon-512.png` | Régénérer (anciennement android-chrome-512x512) | favicon-source.svg |
| `public/apple-touch-icon.png` | Régénérer | favicon-source.svg à 180×180 |
| `public/logo-monogram.svg` | Mettre à jour avec le même design (viewBox 64×64 réduit) | Adapter les paths |

### Vérification layout.tsx

Les balises `<head>` dans `app/layout.tsx` pointent vers `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png` — chemins inchangés, aucune modification de code requise.

### Baselines Playwright

Les screenshots de navigation doivent être régénérés : le favicon est visible dans l'onglet (titre de la page dans les screenshots Playwright avec `headless: false`). Si les baselines incluent les onglets de navigateur, régénérer après déploiement du nouveau favicon.

---

**Handoff → @fullstack**
- Fichiers produits : `docs/design/favicon-redesign-session5.md`, `public/favicon.svg`
- Décision prise : refonte Direction A (sérif classique purs, paths Bézier) — élimine la construction rectangulaire qui donnait l'aspect "Paint"
- Points d'attention :
  - `public/favicon-source.svg` doit recevoir le même contenu SVG que `public/favicon.svg` pour cohérence avec `scripts/generate-assets.mjs` qui lit `favicon-source.svg` comme source ICO
  - `public/logo-monogram.svg` (64×64) doit également être mis à jour pour cohérence visuelle — adapter les paths à l'échelle 64px (facteur ~0.125 par rapport au viewBox 512)
  - Vérification visuelle impérative à 16px et 32px avant déploiement — le "C" doit avoir une courbe visible, pas un angle droit
