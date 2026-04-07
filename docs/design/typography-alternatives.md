# Alternatives typographie — Titres ISSA Capital

> @design — 2026-04-07
> Mission post-deploy : réponse au retour de Thomas sur Cormorant Garamond.
> Contexte : Thomas reconnaît l'élégance mais signale un inconfort visuel ("mal à la tête").
> Ce document propose 3 alternatives à évaluer avant toute modification du code.

---

## Diagnostic : pourquoi Cormorant Garamond "fait mal à la tête"

Le problème est typographique et mesurable. Cormorant Garamond appartient à la famille **Didone haute contraste** (inspirée Garamond du XVIe siècle revisité par Christian Thalmann) : ses pleins sont très lourds, ses déliés sont extrêmement fins — parfois 1px ou moins à l'écran. Ce contraste de graisse extrême crée une **vibration optique** sur écran :

- Les déliés à 1px scintillent sur les écrans LCD à densité normale (96-120 dpi)
- L'œil doit constamment réajuster entre plein très épais et délié quasi-invisible
- En grands titres (H1 à 60-72px), l'effet est beau mais fatigant à prolonger
- En H2/H3 (30-36px), les déliés deviennent quasi illisibles sur certains moniteurs

Ce n'est pas un défaut de Cormorant — c'est sa nature. Elle est conçue pour le print haute résolution, pas pour l'écran. Son usage en display sur écran est un parti pris esthétique assumé qui a un coût : l'inconfort que Thomas ressent.

**L'objectif des alternatives** : conserver l'élégance sérif institutionnelle, réduire le contraste de graisse, améliorer le confort de lecture à toutes tailles d'écran.

---

## Alternative 1 — Crimson Pro

### Identité

- **Foundry** : Jacques Le Bailly (Baron von Fonthausen), Google Fonts
- **Source** : https://fonts.google.com/specimen/Crimson+Pro
- **Licence** : SIL Open Font License 1.1 — usage commercial libre, auto-hébergement WOFF2 autorisé
- **Caractère** : Sérif old-style humaniste, inspirée Garamond/Caslon, optimisée pour l'écran

### Comparaison avec Cormorant

| Critère | Cormorant Garamond | Crimson Pro |
|---|---|---|
| Contraste de graisse | Très élevé (plein/délié = 8:1 environ) | Modéré (plein/délié = 3:1 environ) |
| X-height | Basse — lettres minuscules très petites | Généreuse — lettres bien proportionnées |
| Déliés à 30px | Souvent < 1px, vibration optique | 1.5-2px, tenue stable |
| Lisibilité grand format (H1 60px+) | Spectaculaire mais fatigante | Élégante et confortable |
| Lisibilité format moyen (H2-H3 24-36px) | Déliés fragiles, perte de détail | Stable, serein, lisible |

### Pourquoi elle résout l'inconfort

Crimson Pro réduit drastiquement le contraste plein/délié. Ses terminaisons sont arrondies et ses serifs s'appuient sur une tradition humaniste (vs la tradition didone de Cormorant) — l'œil repose sur des formes plus organiques, moins tirées au cordeau. À grand format, elle conserve un caractère noble sans la tension visuelle.

### Ce qu'elle préserve de l'élégance Cormorant

L'ancrage dans la tradition sérif occidentale classique (Garamond, Caslon), les italiques élancés, le registre institutionnel. Elle évoque les mêmes références éditoriales — impression de qualité, de durée, d'héritage — sans l'effet "rasoir".

### Compatibilité avec Inter (corps)

Excellente. Les deux polices partagent une x-height généreuse et des proportions de lettres modernes. La transition heading Crimson Pro / corps Inter est fluide — pas de choc visuel entre les deux familles.

### Weights disponibles et recommandation

8 poids disponibles : ExtraLight (200), Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800), Black (900).

| Usage | Weight recommandé |
|---|---|
| H1 display (60px+) | SemiBold 600 |
| H2 section (36-48px) | Medium 500 |
| H3 sous-section (24-30px) | Regular 400 italic ou Medium 500 |
| Citation/blockquote | Regular 400 italic |

---

## Alternative 2 — Spectral

### Identité

- **Foundry** : Production Type (Paris), commandé par Google Fonts
- **Source** : https://fonts.google.com/specimen/Spectral
- **Licence** : SIL Open Font License 1.1 — usage commercial libre, auto-hébergement WOFF2 autorisé
- **Caractère** : Sérif transitional contemporain, police variable 7 poids, conçue nativement pour l'écran

### Comparaison avec Cormorant

| Critère | Cormorant Garamond | Spectral |
|---|---|---|
| Contraste de graisse | Très élevé, didone | Moyen-élevé, triangulaire et structuré |
| Nature des serifs | Hairline très fin, fragile | Triangulaires épaissis — robustes à toutes tailles |
| Conçue pour l'écran ? | Non — conçue pour le display print | Oui — screen-first par conception |
| Lisibilité H1 | Belle mais vibrante | Nette, autoritaire, reposante |
| Lisibilité H3 | Déliés fragiles | Stable à 24px et moins |

### Pourquoi elle résout l'inconfort

Spectral a été conçue nativement pour l'écran par Production Type (fonderie française de référence). Ses serifs triangulaires sont plus épais que chez Cormorant — ils "tiennent" aux petites résolutions sans scintiller. À 36px ou moins, la différence est nette : Spectral reste ferme, Cormorant vacille.

### Ce qu'elle préserve de l'élégance Cormorant

Le registre éditorial. Spectral est utilisée dans des contextes éditoriaux exigeants (longform journalism, publishing numérique). Elle a une verticalité et une tenue qui correspondent au positionnement institutionnel d'ISSA Capital. Son origine française (Production Type, Paris) est un détail cohérent avec l'ancrage Nanterre du projet.

### Compatibilité avec Inter (corps)

Très bonne — c'est même le couple canonique le plus cité dans les benchmarks design système : "Spectral (600) headlines + Inter (400) body". Les deux polices ont été conçues pour les environnements numériques, leurs x-heights sont proches, la transition est invisible.

### Weights disponibles et recommandation

7 poids disponibles avec italics : ExtraLight (200), Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800).

| Usage | Weight recommandé |
|---|---|
| H1 display (60px+) | SemiBold 600 |
| H2 section (36-48px) | SemiBold 600 ou Medium 500 |
| H3 sous-section (24-30px) | Medium 500 |
| Citation/blockquote | Light 300 italic |

---

## Alternative 3 — EB Garamond

### Identité

- **Foundry** : Georg Duffner, basé sur le spécimen Berner de 1592 — continuité de la tradition Garamond historique
- **Source** : https://fonts.google.com/specimen/EB+Garamond
- **Licence** : SIL Open Font License 1.1 — usage commercial libre, auto-hébergement WOFF2 autorisé
- **Caractère** : Sérif old-style, renaissance, fidèle aux poinçons de Garamond originaux (contrairement à Cormorant qui en fait une relecture idéalisée)

### Comparaison avec Cormorant

| Critère | Cormorant Garamond | EB Garamond |
|---|---|---|
| Contraste de graisse | Très élevé — didone idéalisé | Modéré — old-style fidèle à l'original |
| Poids standard (400) | Anormalement léger (49% plus léger que la norme) | Poids normal, solide |
| Serifs | Hairline extrêmes | Crénages traditionnels, bien proportionnés |
| Lisibilité moyen format | Déliés fragiles à 24-36px | Stable et lisible à partir de 18px |
| Grand format | Spectaculaire, tendu | Noble, classique, paisible |

### Pourquoi elle résout l'inconfort

EB Garamond est la version historiquement fidèle de Garamond — celle dont Cormorant est une relecture radicalisée. Là où Cormorant a poussé le contraste plein/délié à l'extrême pour un effet esthétique fort, EB Garamond reste dans les proportions des poinçons originaux du XVIe siècle. Le résultat est une police qui évoque la même tradition sans l'effet de tension.

### Ce qu'elle préserve de l'élégance Cormorant

La filiation directe : les deux polices se réclament de la même source. Un lecteur attentif reconnaîtra la parenté. EB Garamond conserve les italiques penchés, les ligatures classiques, le registre humaniste de la Renaissance. Si Thomas aimait Cormorant "mais moins forte", EB Garamond est l'étape naturelle en arrière sur le curseur d'intensité.

### Compatibilité avec Inter (corps)

Bonne, avec une nuance : EB Garamond a une x-height légèrement plus basse qu'Inter. En grand titre ce n'est pas un problème, mais en H3 (24px) la transition corps/titre peut sembler légèrement contrastée. Recommandation : utiliser EB Garamond uniquement pour H1 et H2, et laisser Inter gérer H3 et en-dessous.

### Weights disponibles et recommandation

Weights disponibles : Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800). Italics dans tous les poids.

| Usage | Weight recommandé |
|---|---|
| H1 display (60px+) | SemiBold 600 ou Bold 700 |
| H2 section (36-48px) | Medium 500 |
| H3 sous-section (24-30px) | Regular 400 italic — ou déléguer à Inter Medium |
| Citation/blockquote | Regular 400 italic |

---

## Récapitulatif comparatif

| Critère | Crimson Pro | Spectral | EB Garamond |
|---|---|---|---|
| Réduction inconfort visuel | Forte | Très forte | Moyenne à forte |
| Élégance conservée | Haute | Haute | Très haute |
| Conçue pour l'écran | Oui | Oui (screen-first) | Partiellement |
| Compatibilité Inter | Excellente | Excellente | Bonne (avec précautions H3) |
| Lien identitaire Garamond | Indirect (même inspiration) | Aucun | Direct (même famille) |
| Registre | Élégant, chaleureux | Éditorial, autoritaire | Classique, historique |
| Idéal pour ISSA Capital | Chaleur libanaise + sobriété | Institutionnel rigoureux | Continuité Cormorant adoucie |

---

## Recommandation

**#1 prioritaire : Crimson Pro**

C'est la police qui résout le plus directement le problème tout en préservant la chaleur et l'élégance. Son contraste de graisse modéré élimine la vibration optique, sa x-height généreuse améliore la lisibilité à toutes les tailles, et son caractère old-style humaniste conserve le registre institutionnel sans la tension de Cormorant. Ses italiques sont élancés et élégants — parfaits pour les citations. La compatibilité avec Inter est naturelle.

**#2 : Spectral**

Si Thomas veut un registre plus "rigoureux" et moins chaleureux — plus proche d'un journal institutionnel que d'un éditeur de livres. Spectral est techniquement supérieure pour l'écran (conçue screen-first par une fonderie française), mais son caractère est légèrement plus froid. Recommandée si le positionnement doit pencher davantage vers la rigueur financière que vers la chaleur familiale.

**#3 : EB Garamond**

Solution de continuité si Thomas veut rester dans la même famille typographique mais "baisser le volume". Même ADN que Cormorant, moins d'intensité. Recommandée si Thomas est attaché au style Garamond historique et veut une transition minimale.

**À écarter sans examen** : Playfair Display (contraste encore plus fort que Cormorant — aggrave le problème), Cormorant Upright (même structure, l'italic est juste supprimé — ne résout pas le contraste de graisse).

---

## Note d'implémentation (pour passe ultérieure)

Une fois le choix fait, la modification est limitée à :
1. Télécharger les fichiers WOFF2 de la police choisie (https://fonts.google.com → "Download family")
2. Remplacer les fichiers WOFF2 Cormorant dans `public/fonts/` ou `src/fonts/`
3. Mettre à jour `font-family-heading` dans `design-tokens.json`
4. Mettre à jour la déclaration `@font-face` dans le CSS global
5. Ajuster les weights H1/H2/H3 selon le tableau ci-dessus (les poids diffèrent entre Cormorant et les alternatives)
6. Vérifier visuellement sur les pages hero, piliers, témoignages

Aucune modification de couleur, spacing ou composant n'est nécessaire.

---

## A valider par Thomas

**Mission accomplie — choix requis :**

Trois alternatives à Cormorant Garamond sont proposées. Chacune préserve l'élégance institutionnelle et résout l'inconfort visuel à des degrés différents.

**Quelle direction retiens-tu pour les titres ?**

- **Option A — Crimson Pro** : élégance humaniste chaleureuse, contraste réduit, couple parfait avec Inter. Recommandée.
- **Option B — Spectral** : registre éditorial rigoureux, conçue screen-first, plus froide mais plus autoritaire.
- **Option C — EB Garamond** : continuité directe de Cormorant, même ADN mais "volume baissé". Transition minimale.

Une fois ton choix confirmé, @design produit le SVG du logo mis à jour si nécessaire (le logo actuel est en tracé vectoriel, il n'embarque pas de font — non impacté), @fullstack met à jour les fichiers WOFF2 et les tokens.

---

**Handoff → @orchestrator**
- Fichier produit : `docs/design/typography-alternatives.md`
- Décision en attente : choix de Thomas parmi Crimson Pro / Spectral / EB Garamond
- Une fois choix confirmé → @fullstack pour implémentation (WOFF2 + tokens + CSS)
- Aucune modification de design-tokens.json ni de composants avant validation Thomas
