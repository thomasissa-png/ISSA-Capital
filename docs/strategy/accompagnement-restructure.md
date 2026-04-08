> Sources amont : src/app/accompagnement/page.tsx, docs/strategy/personas.md (section Karim), docs/copy/page-accompagnement.md

# Restructure /accompagnement — Session 5

> Production : @creative-strategy (orchestrateur en exécution directe — Task tool indisponible)
> Date : 2026-04-08
> Retour Thomas adressé : #6 — supprimer verbatim fictif + restructurer pour Karim

---

## Diagnostic

### Verbatim incriminé

Localisation exacte : `src/app/accompagnement/page.tsx` lignes 92-106 — Section "Citation" entre Hero et Proposition.

Citation textuelle :
> « J'ai besoin de quelqu'un qui l'a fait, pas de quelqu'un qui m'explique. »
> — Verbatim entrepreneur accompagné

### Nature exacte du problème

Ce n'est PAS un témoignage légèrement reformulé d'une personne réelle. C'est le **verbatim n°1 du persona Karim** (cf. `docs/strategy/personas.md` ligne 79), recyclé en faux témoignage attribué à un "entrepreneur accompagné" inexistant. Trois violations :

1. **CLAUDE.md règle n°2 (zéro invention)** : un verbatim attribué à un "entrepreneur accompagné" sans entrepreneur réel = fabrication de preuve sociale.
2. **Principe directeur P0 (Simplicité > Démonstration > Élégance)** : une citation montée en grand format en ouverture de page, c'est de la démonstration creuse — exactement ce que la VITRINE doit éviter.
3. **Cohérence persona** : Karim est un décideur pragmatique qui détecte le bullshit en 5 secondes. Présenter son propre verbatim de frustration comme un témoignage d'un autre entrepreneur, c'est lui montrer la manipulation à découvert.

### Test mental Karim

Karim arrive sur la page. Il voit en grand : *« J'ai besoin de quelqu'un qui l'a fait... »* attribué à un "entrepreneur accompagné". Réaction probable :
- Premier réflexe : "OK, témoignage client."
- Deuxième réflexe (3 secondes plus tard) : "Attends, qui exactement ? Pas de nom, pas de société, pas de secteur. C'est qui ce mec ?"
- Troisième réflexe : "C'est inventé. Soit c'est un autre coach qui se vend, soit c'est lui-même qui parle de lui. Bullshit."
- Verdict : friction de crédibilité dès la deuxième section. Le reste de la page perd 30% de capital de confiance.

### Autres détections sur la page (audit complet)

Lecture intégrale du fichier `src/app/accompagnement/page.tsx` — aucun autre verbatim attribué à une personne fictive détecté. Le reste de la page est factuel (parcours Sony, TEOS, clients réels — Lego, Siemens, Netflix, Cap Gemini, Suzuki, Hilton, Mango, TikTok, Adidas, autorisés par Q2 Thomas verrouillée). Pas d'autre fabrication à corriger sur cette page.

---

## Architecture cible

### Ordre de sections proposé

1. **Hero** — conservé tel quel (titre + breadcrumb, sobre)
2. **[NOUVELLE SECTION qui remplace le verbatim]** — voir détail ci-dessous
3. **Proposition — "Ce que Thomas fait"** — conservé
4. **Parcours — "15 ans de décisions"** — conservé
5. **Domaines (Patrimonial / Corporate)** — conservé
6. **Ce qui ne correspond pas** — conservé
7. **Deux formats** — conservé
8. **Signature "Patient par choix..."** — conservé
9. **CTA + formulaire** — conservé

Aucune réorganisation lourde demandée. La seule intervention structurelle est le remplacement de la section "Citation".

---

## Section qui remplace le verbatim — DÉTAIL

### Option A — "Pour qui c'est"

**Nom de section** : "Pour qui" (overline) — H2 : "Pour qui."

**Intention** : Adresser frontalement Karim sans détour, sans témoignage, sans démonstration. Lui dire en 3-4 lignes "voici exactement le profil avec lequel Thomas travaille". Karim s'identifie ou pas — pas de mise en scène.

**Contenu cible (à confier au copywriter)** :
> Un fondateur ou dirigeant qui a déjà fait ses preuves. Qui gère une ou plusieurs structures, qui a déjà pris des décisions de capital, qui n'attend pas qu'on lui apprenne son métier. Qui cherche un pair pour structurer ce qui vient ensuite — patrimoine, holding, immobilier en direct, participations — pas un prestataire qui lui vendra une prestation.
>
> Si vous vous reconnaissez, la suite de cette page est pour vous. Sinon, elle ne le sera pas — et c'est très bien.

**Pourquoi ça parle à Karim** : Le verbatim Karim n°1 (`personas.md`) est *"J'ai besoin de quelqu'un qui l'a fait, pas de quelqu'un qui me vend un produit."* — l'option A reformule cette pensée DU CÔTÉ de Thomas qui parle, pas du côté d'un faux client. C'est honnête, direct, sans manipulation.

**Pourquoi c'est sobre (P0)** : 6 lignes maximum, aucune typographie spectaculaire (pas de blockquote géant), aucun visuel additionnel. La section disparaît presque visuellement entre le hero et la proposition — exactement ce qu'on attend d'une vitrine élégante qui ne hurle pas.

**Risque** : un peu sec si mal rédigé. À atténuer par le ton du copywriter — direct mais pas froid.

---

### Option B — "Le constat"

**Nom de section** : "Le constat" (overline) — H2 : "Pourquoi cette page existe."

**Intention** : Énoncer un constat factuel sur le marché du conseil patrimonial classique — sans nommer personne, sans agressivité, en posant ce qui manque. Karim lit ce constat et reconnaît sa propre frustration sans qu'on la lui prête en bouche.

**Contenu cible (à confier au copywriter)** :
> La plupart des entrepreneurs qui structurent leur patrimoine se retrouvent face à deux interlocuteurs : un expert-comptable qui leur explique la forme juridique, et un conseiller en gestion de patrimoine qui leur propose des produits financiers. Les deux sont compétents dans leur métier. Aucun des deux ne sait construire un écosystème cohérent à partir de zéro, parce qu'aucun des deux n'a eu à le faire pour son propre compte.
>
> Cette page existe parce qu'il manque une troisième voie : celle d'un opérateur qui a structuré, investi, co-fondé, et qui peut accompagner sans vendre.

**Pourquoi ça parle à Karim** : Le persona Karim est explicitement défini comme quelqu'un qui *"a pris rendez-vous avec son expert-comptable... et avec un CGP... aucun des deux n'a vraiment compris ce qu'il cherchait à construire"* (`personas.md` ligne 55). L'option B reprend ce constat comme un état du marché, pas comme une promesse marketing.

**Pourquoi c'est sobre** : Aucune fabrication, aucune statistique inventée, aucun nom. Constat partagé qui pose le contexte sans demander à Karim de s'identifier à un "témoignage".

**Risque** : un peu plus long que l'option A (8-10 lignes), légèrement plus polémique vis-à-vis des CGP. À surveiller pour ne pas tomber dans l'attaque (P0 demande sobriété, pas combat).

---

## Recommandation

**Option A** — "Pour qui c'est".

**Raison décisive** : 
1. Plus courte (6 lignes vs 10) → mieux alignée avec P0 Simplicité.
2. Plus directe vis-à-vis de Karim (lui parle à la 2e personne, pas constat tiers) → meilleur engagement persona.
3. Évite tout angle polémique vis-à-vis d'autres professions (CGP, EC) → cohérent avec la posture Ruler/Outlaw modérée d'ISSA Capital.
4. Facile à valider en 5 secondes : Karim lit "qui a déjà pris des décisions de capital" et sait en une ligne s'il est concerné ou pas — c'est un filtre net, exactement ce qu'attend ce persona.

L'option B reste valable comme **fallback** si Thomas trouve l'option A "trop sèche" en validation copy.

---

## Ce qui doit être supprimé exactement

Dans `src/app/accompagnement/page.tsx`, supprimer intégralement :

```tsx
{/* Citation */}
<Section tone="elevated">
  <Container width="editorial">
    <figure className="border-l-2 border-levant-500 pl-lg">
      <blockquote>
        <p className="font-heading text-h2 italic text-ink-950">
          « J&apos;ai besoin de quelqu&apos;un qui l&apos;a fait, pas de quelqu&apos;un
          qui m&apos;explique. »
        </p>
      </blockquote>
      <figcaption className="mt-md text-sm text-ink-500">
        — Verbatim entrepreneur accompagné
      </figcaption>
    </figure>
  </Container>
</Section>
```

= toute la section "Citation" (lignes 92-106 inclus).

À remplacer par la nouvelle section (Option A — voir Hand-off ci-dessous).

---

## Ce qui doit être ajusté sur les autres sections

Aucun ajustement structurel demandé sur les autres sections. Un seul **point de vigilance copywriter** : le bloc "Parcours" (Section 3) contient déjà une auto-citation implicite via la mention "Verbatim Karim" en filigrane dans le copy d'origine (`page-accompagnement.md` ligne 56). Cette mention n'apparaît PAS dans le code .tsx déployé (vérifié) — donc pas de correction nécessaire côté production. À surveiller en Phase B.

---

## Hand-off → @copywriter

**Section à rédiger** : "Pour qui" (Option A — recommandée)

**Placement dans la page** : entre Hero et Proposition (remplace exactement la section "Citation" supprimée)

**Intention narrative** : poser un filtre de qualification self-service — Karim s'identifie ou pas en 5 secondes, sans qu'on lui prête de mots dans la bouche.

**Tonalité** : 
- Sobre, directe, factuelle
- 2e personne ("vous") pour interpeller Karim
- ZÉRO bullshit
- ZÉRO verbatim attribué à qui que ce soit
- ZÉRO superlatif ("meilleur", "premier", "exceptionnel")
- ZÉRO promesse de résultat
- Énoncer une posture, pas un argument de vente

**Contraintes** :
- 80-130 mots maximum (l'Option A faite ci-dessus = 95 mots, c'est la cible)
- Pas de chiffre inventé
- Pas d'attaque frontale envers d'autres professions
- Identité libanaise non obligatoire à cet endroit (déjà portée par les autres sections)
- Cohérent avec brand-voice.md (registre vous, ton éditorial, sobre)

**Critère de validation binaire** : Karim doit lire ces 6 lignes et penser *"OK, c'est pour moi"* OU *"Non, c'est pas pour moi"* — sans hésitation. Si la lecture laisse une impression neutre/floue, la section est ratée.

**Composant cible** : pas de figure/blockquote. Une simple `<Section tone="default">` avec `<Container width="editorial">` + Overline + H2 + paragraphe(s). Sobre, plat visuellement.

---

## Hand-off → @fullstack (après copy)

**Modifications structurelles attendues sur `src/app/accompagnement/page.tsx`** :

1. Supprimer lignes 92-106 (toute la section "Citation" avec figure/blockquote/figcaption)
2. Insérer à la place une nouvelle `<Section tone="default">` avec :
   - Overline : "Pour qui"
   - H2 : "Pour qui." (avec point final, cohérence avec les autres H2 de la page)
   - Paragraphes contenant le copy fourni par @copywriter
   - Container width="editorial"
3. Vérifier que le tone="default" enchaîne correctement avec le tone="default" de la Section "Proposition" qui suit (deux sections de même tone consécutives — vérifier visuellement qu'il n'y a pas de cassure de rythme)
4. Si cassure de rythme détectée : alternative = `tone="subtle"` pour cette nouvelle section, à arbitrer en boucle visuelle Playwright
5. Régénérer les 3 baselines Playwright pour `/accompagnement` (iPhone 13 / iPad / Desktop) après implémentation

**Impact build** : aucun (pas de nouveau composant, pas de nouvelle dépendance). Build doit rester green.

---

## Critères d'acceptation finaux (binaires)

- [x] Verbatim incriminé identifié avec citation exacte
- [x] Nature du problème explicitée (3 violations documentées)
- [x] 2 options proposées (A "Pour qui" + B "Le constat")
- [x] Recommandation tranchée (Option A) avec raison décisive
- [x] Hand-off @copywriter clair (intention, tonalité, contraintes, critère)
- [x] Hand-off @fullstack clair (lignes à supprimer, structure JSX, baselines)
- [x] Aucun nouveau verbatim fictif introduit
- [x] Identité libanaise respectée (non forcée à cet endroit, portée ailleurs)
- [x] Conformité P0 Simplicité > Démonstration > Élégance

---

**Handoff → @copywriter**
- Fichier produit : `docs/strategy/accompagnement-restructure.md`
- Décision clé : Option A "Pour qui" — section sobre 80-130 mots remplaçant le verbatim fictif
- Prochain agent : @copywriter rédige la section "Pour qui" + intègre dans `docs/copy/page-accompagnement.md`
- Points d'attention : cible 6 lignes max, ton direct sans agressivité, critère binaire d'identification Karim
