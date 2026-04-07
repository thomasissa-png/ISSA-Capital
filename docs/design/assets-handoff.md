# Assets Handoff — ISSA Capital

> @design — 2026-04-07
> Inventaire des assets visuels produits, instructions de conversion SVG vers binaires, checklist post-build.

---

## 1. Inventaire des fichiers produits

### SVG sources (dans `public/`)

| Fichier | Dimensions | Usage | Statut |
|---|---|---|---|
| `logo.svg` | 320×64 | Logo principal — fond clair (sur parchment-100) | Existant |
| `logo-inverse.svg` | 320×64 | Logo inverse — fond sombre (sur ink-950) | Existant |
| `logo-monogram.svg` | 64×64 | Monogramme I — usage compact, nav mobile | Existant |
| `favicon.svg` | 32×32 | Favicon moderne navigateurs supportés | Existant |
| `favicon-source.svg` | 48×48 | Source SVG pour génération favicon.ico | Existant |
| `apple-touch-icon.svg` | 180×180 | Source pour apple-touch-icon.png | Existant |
| `android-chrome-192x192.svg` | 192×192 | Source pour android-chrome-192x192.png | Existant |
| `android-chrome-512x512.svg` | 512×512 | Source pour android-chrome-512x512.png | Existant |
| `og-image-source.svg` | 1200×630 | Source pour og-image.png (Open Graph) | Existant |

### Binaires à générer (dans `public/`)

| Fichier cible | Source SVG | Taille | Statut |
|---|---|---|---|
| `favicon.ico` | `favicon-source.svg` | multi-tailles 16/32/48 | **A GÉNÉRER** |
| `apple-touch-icon.png` | `apple-touch-icon.svg` | 180×180 | **A GÉNÉRER** |
| `android-chrome-192x192.png` | `android-chrome-192x192.svg` | 192×192 | **A GÉNÉRER** |
| `android-chrome-512x512.png` | `android-chrome-512x512.svg` | 512×512 | **A GÉNÉRER** |
| `og-image.png` | `og-image-source.svg` | 1200×630 | **A GÉNÉRER** |

### Manifest PWA (dans `public/`)

| Fichier | Statut |
|---|---|
| `site.webmanifest` | Existant |

---

## 2. Instructions de conversion — Option A : script Node automatique (recommandé)

Le projet utilise Next.js — ajouter `sharp` (déjà dans les dépendances Next.js) comme outil de conversion.

### Installation (si sharp absent)

```bash
npm install --save-dev sharp
```

### Script de génération : `scripts/generate-assets.mjs`

Créer ce fichier à la racine du projet :

```js
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function convertSvgToPng(svgFile, pngFile, width, height) {
  const svgBuffer = readFileSync(join(publicDir, svgFile));
  await sharp(svgBuffer)
    .resize(width, height)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(join(publicDir, pngFile));
  console.log(`Generated: ${pngFile} (${width}x${height})`);
}

async function generateFaviconIco() {
  // Générer les PNG intermédiaires pour le .ico
  const svgBuffer = readFileSync(join(publicDir, 'favicon-source.svg'));

  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(svgBuffer).resize(size, size).png().toBuffer()
    )
  );

  // Note : sharp ne génère pas nativement le .ico
  // Utiliser la méthode ImageMagick (Option B ci-dessous) pour le .ico
  // Ou utiliser le package 'png-to-ico' :
  // npm install --save-dev png-to-ico
  // import pngToIco from 'png-to-ico';
  // const ico = await pngToIco(pngBuffers);
  // writeFileSync(join(publicDir, 'favicon.ico'), ico);

  console.log('Favicon ICO : voir Option B (ImageMagick) ou ajouter png-to-ico');
}

async function main() {
  await convertSvgToPng('apple-touch-icon.svg', 'apple-touch-icon.png', 180, 180);
  await convertSvgToPng('android-chrome-192x192.svg', 'android-chrome-192x192.png', 192, 192);
  await convertSvgToPng('android-chrome-512x512.svg', 'android-chrome-512x512.png', 512, 512);
  await convertSvgToPng('og-image-source.svg', 'og-image.png', 1200, 630);
  await generateFaviconIco();
  console.log('Assets générés avec succès.');
}

main().catch(console.error);
```

### Exécution

```bash
node scripts/generate-assets.mjs
```

### Ajouter dans `package.json`

```json
{
  "scripts": {
    "generate:assets": "node scripts/generate-assets.mjs"
  }
}
```

---

## 3. Instructions de conversion — Option B : ImageMagick (CLI)

Si ImageMagick est disponible sur la machine (`convert --version`).

### PNG individuels

```bash
# Apple Touch Icon (180×180)
rsvg-convert -w 180 -h 180 public/apple-touch-icon.svg -o public/apple-touch-icon.png

# Android Chrome 192 (192×192)
rsvg-convert -w 192 -h 192 public/android-chrome-192x192.svg -o public/android-chrome-192x192.png

# Android Chrome 512 (512×512)
rsvg-convert -w 512 -h 512 public/android-chrome-512x512.svg -o public/android-chrome-512x512.png

# OG Image (1200×630)
rsvg-convert -w 1200 -h 630 public/og-image-source.svg -o public/og-image.png
```

### Favicon ICO multi-tailles

```bash
# Étape 1 : générer les PNG intermédiaires
rsvg-convert -w 16 -h 16 public/favicon-source.svg -o /tmp/favicon-16.png
rsvg-convert -w 32 -h 32 public/favicon-source.svg -o /tmp/favicon-32.png
rsvg-convert -w 48 -h 48 public/favicon-source.svg -o /tmp/favicon-48.png

# Étape 2 : assembler le .ico
convert /tmp/favicon-16.png /tmp/favicon-32.png /tmp/favicon-48.png public/favicon.ico
```

### Alternative ImageMagick sans rsvg-convert (SVG natif)

```bash
# ImageMagick peut lire les SVG directement (nécessite Inkscape ou librsvg installé)
convert -density 96 -background '#0A0A0A' public/favicon-source.svg \
  -define icon:auto-resize=16,32,48 public/favicon.ico
```

---

## 4. Instructions de conversion — Option C : Inkscape CLI

```bash
# PNG (Inkscape 1.0+)
inkscape public/og-image-source.svg --export-type=png \
  --export-width=1200 --export-height=630 \
  --export-filename=public/og-image.png

inkscape public/apple-touch-icon.svg --export-type=png \
  --export-width=180 --export-height=180 \
  --export-filename=public/apple-touch-icon.png
```

---

## 5. Référencement dans le code Next.js

@fullstack doit référencer ces fichiers dans le code. Voici les intégrations attendues :

### `app/layout.tsx` — metadata icons

```tsx
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/site.webmanifest',
  openGraph: {
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ISSA Capital — Racines libanaises. Exigences sans exception.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
};
```

### `app/layout.tsx` — lien manifest HTML (si metadata insuffisant)

```tsx
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#0A0A0A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

### Usage logo dans les composants

```tsx
// Logo principal (sur fond clair)
<Image src="/logo.svg" alt="ISSA Capital" width={320} height={64} priority />

// Logo inverse (sur fond sombre)
<Image src="/logo-inverse.svg" alt="ISSA Capital" width={320} height={64} priority />

// Monogramme compact (nav mobile, footer)
<Image src="/logo-monogram.svg" alt="ISSA Capital" width={40} height={40} />

// Favicon SVG (dans <head> via metadata)
// Référencé automatiquement via metadata.icons
```

### JSON-LD Organization (dans app/layout.tsx ou composant SchemaOrg)

```tsx
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ISSA Capital",
  "url": "https://issa-capital.com",
  "logo": "https://issa-capital.com/logo.svg",
  "image": "https://issa-capital.com/og-image.png",
  "description": "La holding patrimoniale d'une famille aux racines libanaises qui investit pour les générations à venir"
};
```

---

## 6. Checklist post-build

Avant de considérer les assets comme "production-ready", vérifier point par point :

### Conversion binaires
- [ ] `public/favicon.ico` existe (multi-tailles 16/32/48)
- [ ] `public/apple-touch-icon.png` existe (180×180)
- [ ] `public/android-chrome-192x192.png` existe (192×192)
- [ ] `public/android-chrome-512x512.png` existe (512×512)
- [ ] `public/og-image.png` existe (1200×630)

### Vérification visuelle
- [ ] Favicon visible dans l'onglet navigateur (fond noir, I crème, filet ocre)
- [ ] Favicon lisible à 16px — formes simples, pas de détail perdu
- [ ] OG Image : vérifier sur https://www.opengraph.xyz ou https://metatags.io
- [ ] Apple Touch Icon : ajouter en favori sur iPhone Safari, vérifier l'icône
- [ ] Logo SVG rendu correctement sur fond crème ET fond noir (via browser DevTools)

### Manifest PWA
- [ ] `site.webmanifest` servi sans erreur 404 (vérifier Network tab)
- [ ] `theme-color` #0A0A0A visible sur mobile Chrome (barre de statut noire)
- [ ] Ajouter à l'écran d'accueil Android : icône 192 et 512 visibles

### Métadonnées Open Graph
- [ ] `og:image` pointe vers `/og-image.png` (URL absolue en production)
- [ ] `og:title` = "ISSA Capital"
- [ ] `og:description` cohérent avec la baseline de marque
- [ ] Preview Twitter Card configurée (summary_large_image)

### Accessibilité
- [ ] Tous les SVG ont un `<title>` et `role="img"` + `aria-label`
- [ ] Logo `<img>` a un `alt="ISSA Capital"` dans tous les composants
- [ ] Pas de SVG décoratif sans `aria-hidden="true"`

---

## 7. Notes de design

### Cohérence de marque
- Tous les assets utilisent exclusivement la palette verrouillée : ink-950 `#0A0A0A`, parchment-100 `#F5F0E8`, levant-500 `#C4935A`
- Zéro gradient, zéro shadow, zéro effet brillant — sobriété éditoriale
- Le monogramme "I" avec empattements serif est la signature reconnaissable à toutes les tailles
- L'accent ocre levantin (`#C4935A`) apparaît systématiquement comme filet sous l'empattement bas — c'est la signature graphique du système

### Logique OG Image
- Fond ink-950 pour contraste maximal lors du partage sur fond blanc (LinkedIn, Twitter)
- Baseline en Cormorant Garamond italic — si la police n'est pas embarquée dans le rendu SVG, elle sera substituée par Georgia (fallback serif) — acceptable pour l'OG
- Pour un rendu typographique parfait, utiliser Puppeteer/playwright pour générer l'OG en screenshot HTML plutôt que SVG-vers-PNG

### Favicon ICO
- Le `.ico` legacy est optionnel si `favicon.svg` est référencé en priorité dans les metadata Next.js
- Les navigateurs modernes (Chrome 80+, Firefox 42+, Safari 10+) supportent `image/svg+xml` pour les favicons
- IE11 et anciens navigateurs utilisent favicon.ico comme fallback

---

**Handoff → @fullstack**
- Fichiers SVG sources dans `public/` : tous présents
- `site.webmanifest` dans `public/` : présent, prêt
- Binaires PNG et ICO à générer via `node scripts/generate-assets.mjs` (créer le script) ou ImageMagick
- Intégrer dans `app/layout.tsx` : metadata icons, manifest, openGraph.images — voir section 5
- JSON-LD Organization à implémenter avec `logo: "https://issa-capital.com/logo.svg"`
