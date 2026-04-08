> Sources amont : src/app/mission/page.tsx, src/app/a-propos/page.tsx

# Audit Mission vs À propos — Session 6

## 1. Synthèse exécutive

Les deux pages racontent la même histoire (famille Issa, filiation Jean-Pierre → Thomas, identité libanaise, horizon intergénérationnel) avec les mêmes personnages, le même vocabulaire et le même registre. Le doublon est réel et documenté. **Recommandation : Option A — Fusion. Garder /mission, absorber les éléments uniques d'À propos, supprimer /a-propos.**

---

## 2. Analyse différentielle

### 2.1 Page /mission

- **Intention narrative principale** : poser le "pourquoi" et les règles du jeu — raison d'être de la holding, principes de décision, filtres non négociables. La page répond à la question "Pourquoi ISSA Capital existe et comment elle décide."
- **Sections et messages-clés** :
  - Hero : "Famille libanaise. Horizons intergénérationnels."
  - Filiation Jean-Pierre → Thomas (résumé, 4 paragraphes)
  - "Une décision simple" — indépendance, contrôle privé
  - Identité : "Racines libanaises. Ancrée en France."
  - Vision 30 ans — enfants de Thomas comme horizon
  - 3 filtres de décision (horizon long terme, environnement, éthique humaine)
  - "Ce que nous sommes" — holding patrimoniale familiale, pas de capitaux tiers
- **Vocabulaire dominant** : filtres, décision, filiation, transmission, génération, patrimoine, indépendance, horizon
- **Public adressé** : Karim curieux qui veut comprendre les règles du jeu avant d'aller plus loin

### 2.2 Page /a-propos

- **Intention narrative principale** : raconter QUI sont les Issa — les personnes, les parcours biographiques détaillés, la vie familiale concrète. La page répond à "Qui sont ces gens ?"
- **Sections et messages-clés** :
  - Hero : "Une famille d'origine libanaise. Un projet de trois générations."
  - Jean-Pierre — biographie complète (Dakar, IBM, Lexmark, 2J Impression, mention de Sonia)
  - Thomas — parcours détaillé (Florimont, Irvine, Inde, Sony, TEOS, agence, TikTok/Adidas/Lego)
  - "Ce que tout cela construit" — Antoine, Noémie, Lucas avec prénoms et dates de naissance
  - Fermeture sobre → /mission et /participations
- **Vocabulaire dominant** : racines, parcours, fondateur, famille, construire, hériter, transmettre, biographie
- **Public adressé** : Karim convaincu (ou curieux approfondi) qui veut valider la crédibilité humaine des personnes derrière la structure

### 2.3 Matrice de chevauchement

| Idée / Section | /mission | /a-propos | Verdict |
|---|---|---|---|
| Jean-Pierre Issa — naissance Dakar 1958, famille libanaise | Oui | Oui | **Doublon** — /a-propos plus détaillé (IBM, Lexmark, 2J Impression) |
| Filiation Jean-Pierre → Thomas comme héritage | Oui | Oui | **Doublon** — même idée, formulations proches |
| Identité libanaise + ancrage France | Oui | Oui | **Doublon** — formulé dans les 2 heroes ET dans des sections dédiées |
| Horizon intergénérationnel / 3 générations | Oui | Oui | **Doublon** — "Vision 30 ans" (mission) vs Section D (a-propos) |
| Thomas comme continuateur du legs paternel | Oui | Oui | **Doublon** — même narrative |
| Enfants de Thomas (Antoine, Noémie, Lucas) | Oui (implicite "3 enfants") | Oui (prénoms + dates) | Partiel — /a-propos plus concret |
| 3 filtres de décision | Oui | Non | **Unique à /mission** |
| "Aucun capital tiers" — holding privée | Oui | Non | **Unique à /mission** |
| Parcours Thomas (Florimont, Irvine, Inde, Sony, TEOS, agence) | Non | Oui | **Unique à /a-propos** |
| Sonia Issa (mère, architecte d'intérieur) | Non | Oui | **Unique à /a-propos** |
| Parcours Jean-Pierre détaillé (IBM années 80, Lexmark 1991, 2J 1994, 17 pays, 4M€ CA) | Résumé court | Détaillé | **À propos plus riche** |
| Agence Thomas (TikTok, Adidas, Lego, 35 experts) | Non | Oui | **Unique à /a-propos** |

---

## 3. Recommandation

### Option retenue : A — FUSION

**Les deux pages racontent la même histoire à la même personne avec le même ton.** Un visiteur qui lit /a-propos puis /mission (ou l'inverse) rencontre deux fois Jean-Pierre, deux fois la filiation, deux fois l'identité libanaise, deux fois l'horizon intergénérationnel. Ce doublon n'est pas une richesse narrative — c'est une friction qui signal un problème d'architecture.

L'argument de Thomas ("garder Mission, absorber À propos") est stratégiquement juste. /mission a déjà l'ossature complète : raison d'être, identité, vision, filtres. Ce qui manque à /mission par rapport à /a-propos : la profondeur biographique (parcours Thomas détaillé, Sonia, prénoms des enfants, chiffres de l'agence), c'est-à-dire exactement ce qui rend les personnes crédibles aux yeux de Karim.

La fusion résout le doublon en consolidant "le pourquoi" (filtres, décision, vision) et "le qui" (personnes réelles, parcours, famille) dans une seule page narrative. /mission devient la page de référence complète — celle qu'un partenaire potentiel lit de bout en bout pour décider si Thomas est l'homme avec qui il veut travailler.

/a-propos n'a pas de raison narrative indépendante : elle ne porte ni les filtres de décision, ni la promesse de la holding, ni les liens vers les participations. Elle s'achève sur un lien vers /mission — signe qu'elle perçoit elle-même sa propre incomplétude.

---

## 4. Plan d'exécution

### Éléments d'À propos qui migrent vers Mission

1. **Biographie Jean-Pierre complète** (Section B) — version détaillée : IBM années 1980, Lexmark 1991, 2J Impression 1994, 17 pays, 4M€ CA, Co-Managing Director. Remplace la version résumée actuelle dans /mission.
2. **Mention Sonia Issa** (citation en italique, Section B) — "À ses côtés depuis le début, Sonia Issa — architecte d'intérieur — a donné à la famille son sens de l'espace, de la forme et du beau." Aucun équivalent dans /mission.
3. **Parcours Thomas détaillé** (Section C) — Florimont Genève, Afrique du Sud, UC Irvine, Inde (engagement humanitaire), Sony, TEOS, création et développement de l'agence (35 experts, TikTok / Adidas / Lego), départ en 2025. Absent de /mission.
4. **Prénoms et dates des enfants** (Section D) — Antoine (2015), Noémie (2018), Lucas (2023). /mission mentionne "trois enfants" sans les nommer — /a-propos rend l'horizon transmissif concret et humain.

### Éléments d'À propos coupés (et pourquoi)

- **Hero /a-propos** ("Une famille d'origine libanaise. Un projet de trois générations.") — doublon exact du hero /mission. Coupé.
- **Section E fermeture** (liens vers /mission et /participations) — /mission a déjà ses propres liens de sortie. Coupé.
- **Redondances narratives** sur la filiation et l'identité libanaise — une seule occurrence par idée dans la page fusionnée.

### Restructuration de /mission après fusion

Ordre narratif recommandé pour la page fusionnée :
1. Hero (inchangé)
2. "Ce qui précède la holding" — Jean-Pierre (version complète avec Sonia)
3. "Le fondateur" — Thomas (parcours détaillé, nouvelle section)
4. "Ce que tout cela construit" — famille, prénoms des enfants
5. "La décision fondatrice" (inchangée)
6. "L'identité" (inchangée)
7. "La vision à trente ans" (inchangée)
8. "Trois filtres. Aucune exception." (inchangée)
9. "Ce que nous sommes" (inchangée, liens de sortie)

### Impact menu/nav

- Action @fullstack : retirer "À propos" du menu principal de navigation
- Action @fullstack : vérifier tous les liens internes pointant vers `/a-propos` et les rediriger vers `/mission` (inclus le lien dans la Section E d'/a-propos elle-même)
- Action @fullstack : vérifier footer si "À propos" y figure

### Impact sitemap.xml

- Action @fullstack : retirer l'entrée `/a-propos` du sitemap
- Action @fullstack : vérifier que `/mission` est en priorité correcte (0.8 recommandé pour page éditoriale clé)

### Redirection 301 /a-propos → /mission

- Action @fullstack : ajouter dans `next.config.js` (ou équivalent) :
  ```js
  { source: '/a-propos', destination: '/mission', permanent: true }
  ```

### Impact testeur-karim baselines Playwright

- Action @qa : régénérer les baselines Playwright pour `/mission` (page modifiée avec contenu fusionné)
- Action @qa : vérifier que le test sur `/a-propos` est supprimé ou mis à jour pour tester la redirection 301

### Estimation Tasks producteurs nécessaires

**3 Tasks producteurs** :
1. @copywriter — réécriture de /mission avec absorption des éléments listés (restructuration narrative + intégration biographies complètes)
2. @fullstack — suppression /a-propos + redirection 301 + nav + sitemap
3. @qa — régénération baselines Playwright + test redirection

---

## 5. Risques et points d'attention

- **Longueur de page** : la fusion ajoute ~600 mots à /mission. Risque de page trop longue si les redondances ne sont pas éliminées proprement. @copywriter doit couper les doublons, pas juste coller les sections.
- **JSON-LD Person Thomas** : il est actuellement dans /mission. Après fusion, vérifier qu'il est toujours bien placé et qu'aucun JSON-LD n'était dans /a-propos (il n'y en a pas — vérifié).
- **Ton /a-propos vs /mission** : /a-propos est légèrement plus biographique/narratif, /mission plus déclaratif/principes. @copywriter doit harmoniser le registre pour que la page fusionnée soit cohérente du début à la fin.
- **Sonia Issa** : mention délicate — valider avec Thomas qu'il est à l'aise avec cette mention dans /mission (elle était dans /a-propos, contexte différent).
- **Prénoms des enfants** : même question de validation avec Thomas — les prénoms et dates de naissance sont dans /a-propos, mais passer dans /mission donne plus de visibilité à ces données personnelles.
- **SEO** : `/a-propos` a probablement peu de liens entrants (site récent), la perte d'autorité est négligeable avec le 301. À confirmer.

---

## Handoff

- **À @copywriter** : refonte de la page `/mission` avec absorption des éléments listés en section 4 (biographie complète Jean-Pierre, Sonia, parcours Thomas détaillé, prénoms enfants). Restructuration narrative en 9 sections dans l'ordre documenté. Éliminer les doublons de formulation, harmoniser le ton.
- **À @fullstack** : suppression du fichier `src/app/a-propos/page.tsx` + redirection 301 dans `next.config.js` + retrait du menu nav + retrait du sitemap + vérification de tous les liens internes pointant vers `/a-propos`
- **À @qa** : régénération baselines Playwright pour `/mission` (contenu étendu) + suppression ou conversion du test `/a-propos` en test de redirection
- **À Thomas** : décision finale sur (1) mention Sonia dans /mission, (2) prénoms enfants dans /mission — ces deux éléments migrent depuis /a-propos qui disparaît
