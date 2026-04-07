# Fonts EB Garamond — ISSA Capital

## Action requise (Thomas — TODO humain)

Les fichiers WOFF2 EB Garamond ne peuvent pas être téléchargés automatiquement
depuis l'environnement sandbox. Ils doivent être téléchargés manuellement.

### Option A — Via fontsource (recommandé, npm)

```bash
cd /chemin/vers/ISSA-Capital
npm install @fontsource/eb-garamond
# Copier les fichiers nécessaires :
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2 public/fonts/eb-garamond/
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2 public/fonts/eb-garamond/
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2 public/fonts/eb-garamond/
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2 public/fonts/eb-garamond/
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-italic.woff2 public/fonts/eb-garamond/
```

### Option B — Via Google Fonts

Télécharger la famille complète depuis :
https://fonts.google.com/specimen/EB+Garamond
Cliquer "Download family" et extraire les fichiers TTF.
Convertir en WOFF2 via https://cloudconvert.com/ttf-to-woff2

### Fichiers cibles (à placer dans ce dossier)

| Fichier | Weight | Style | Usage |
|---|---|---|---|
| `eb-garamond-400.woff2` | 400 Regular | Normal | Corps, H3 |
| `eb-garamond-400-italic.woff2` | 400 Regular | Italic | Citations, blockquotes |
| `eb-garamond-500.woff2` | 500 Medium | Normal | H2 section |
| `eb-garamond-600.woff2` | 600 SemiBold | Normal | H1 display, H2 fort |
| `eb-garamond-600-italic.woff2` | 600 SemiBold | Italic | Accents éditoriaux |

### Étape suivante (après téléchargement)

Une fois les fichiers en place, ajouter ces @font-face dans src/app/globals.css
AVANT la déclaration --font-eb-garamond :

```css
@font-face {
  font-family: 'EB Garamond';
  src: url('/fonts/eb-garamond/eb-garamond-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EB Garamond';
  src: url('/fonts/eb-garamond/eb-garamond-400-italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'EB Garamond';
  src: url('/fonts/eb-garamond/eb-garamond-500.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EB Garamond';
  src: url('/fonts/eb-garamond/eb-garamond-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EB Garamond';
  src: url('/fonts/eb-garamond/eb-garamond-600-italic.woff2') format('woff2');
  font-weight: 600;
  font-style: italic;
  font-display: swap;
}
```

Puis mettre à jour --font-eb-garamond :
```css
--font-eb-garamond: 'EB Garamond', 'Garamond', Georgia, serif;
```

### Licence

EB Garamond — SIL Open Font License 1.1
Usage commercial libre, auto-hébergement WOFF2 autorisé.
Auteur : Georg Duffner, basé sur le spécimen Berner de 1592.
