# Prompt Claude Cowork — Enrichir les 6 SKILL.md restantes (audit S21)

> À copier-coller dans une conversation avec Claude Cowork (qui a accès au vault Drive).
> Date : 2026-05-22 · Origine : audit qualité orchestrator post-S21, après l'enrichissement cr-reunion validé.

---

## CONTEXTE DE LA MISSION

Tu vas enrichir 6 fichiers SKILL.md du vault `00. Me/08. Outils/Skills/<nom>/` avec les éléments manquants identifiés lors de l'audit qualité de l'orchestrator Anya. Les skills sont déjà solides — il s'agit d'ajouts ciblés, pas de refonte. Un seul cas est juridiquement critique (`baux` — annexes obligatoires loi 89-462) ; les 5 autres sont des améliorations qualité.

**Objectif** : combler les trous identifiés sans casser la structure narrative existante. Tu PATCH chaque fichier en intégrant les sections proposées au bon endroit (les patchs ci-dessous indiquent où). Tu préserves le frontmatter Anthropic Skills (`name` + `description`) et le reste du contenu existant.

---

## INSTRUCTIONS TECHNIQUES GÉNÉRALES

### Méthode d'édition (R5 obligatoire)

**PATCH in-place via `_zap_raw_request`** pour chaque fileId :
```
endpoint = /upload/drive/v3/files/{fileId}?uploadType=media
method = PATCH
body = <contenu markdown complet réécrit>
```

**Jamais create+delete** (casse fileId, wikilinks Obsidian, partages).

### Procédure pour chaque skill

1. Lis le SKILL.md vault actuel via MCP Drive `read_file_content`.
2. Identifie les sections existantes.
3. Insère les patchs ci-dessous au bon endroit (cf. mapping "Où insérer").
4. PATCH le fichier complet — envoie le markdown entier via `body` (pas `data` — bug Zapier connu).
5. Re-lis le fichier après PATCH pour confirmer.
6. Demande validation visuelle à Thomas dans Obsidian (R6 — ne jamais conclure "ça marche" après 1 test technique côté Drive).

### Ordre recommandé (du plus critique au moins critique)

1. **`baux`** ← juridiquement bloquant (annexes loi 89-462)
2. **`fiche-candidat`** ← RGPD conservation
3. **`quittance`** ← paiement partiel
4. **`draft-email`** ← threading email + newsletters
5. **`fin-de-bail`** ← cas litigieux
6. **`traite-inbox`** ← erreurs binaires

---

## 1. `baux` (⚠️ CRITIQUE — annexes obligatoires loi 89-462)

**fileId** : `1FPbqsDsVgHWin8Lo___1RgQDlim_rJt7`
**Sévérité** : 🔴 bloquant juridique — un bail sans DPE annexé est nul de plein droit (loi ELAN 2018).

### Trou identifié

Le SKILL.md actuel mentionne « état des lieux + inventaire » dans § 5.2 mais **ne liste pas les annexes obligatoires** requises par la loi 89-462 modifiée. Le script `generer_bail.py` les ignore-t-il ou les annexe-t-il automatiquement ? Le SKILL.md doit le dire explicitement.

### À insérer

> Nouvelle sous-section **§ 5.5 Annexes obligatoires loi 89-462** (après § 5.4 Exemple, avant `## Contenu du bundle`).

```markdown
### 5.5 Annexes obligatoires loi 89-462 (bloquantes)

Un bail meublé d'habitation est **nul de plein droit** si certaines annexes manquent. La skill ne génère **pas** ces diagnostics — Thomas les fournit séparément — mais le SKILL.md doit lister ce qui doit être joint au bail au moment de la transmission au locataire.

| Annexe | Obligation | Source légale |
|---|---|---|
| **DPE** (diagnostic performance énergétique) | Tous baux d'habitation | Loi ELAN 2018, opposable depuis 2021 |
| **État des risques (ERP)** | Si bien en zone risques naturels / technologiques / miniers / radon | Code env. art. L125-5 |
| **Notice d'information** droits et obligations du locataire et du bailleur | Tous baux meublés | Arrêté 29 mai 2015 |
| **CREP** (constat risque exposition au plomb) | Logements construits avant le 1er janvier 1949 | Code santé publique art. L1334-5 |
| **État amiante** (parties privatives) | Logements construits avant le 1er juillet 1997 | Code santé publique art. L1334-13 |
| **Audit énergétique** | Logements classés F ou G au DPE (passoires thermiques) | Loi Climat 2021, vigueur 2025 pour location |
| **Diagnostic gaz** | Si installation gaz > 15 ans | Décret 2016-1104 |
| **Diagnostic électricité** | Si installation électrique > 15 ans | Décret 2016-1105 |
| **Inventaire et état détaillé du mobilier** | Tous baux meublés | Loi ALUR 2014 (liste minimale 11 éléments : literie + lit + plaques + four/micro-ondes + frigo + congélateur + vaisselle + ustensiles + table + sièges + étagères + luminaires + entretien ménager) |
| **État des lieux d'entrée** | Tous baux | Loi 89-462 art. 3-2 |

**Red line ajoutée** : le PDF du bail seul est insuffisant pour la transmission au locataire. Le script `generer_bail.py` produit le contrat ; Thomas doit y joindre manuellement les diagnostics du bien depuis `02. Projets/01. Perso/Immobilier Direct/[Bien]/Documents/Diagnostics/` avant remise des clés. Si l'un de ces diagnostics est manquant ou périmé, ne pas transmettre le bail tant que le diagnostic n'est pas renouvelé.

**Validité par bien** : le SKILL.md ne stocke pas la liste actuelle des diagnostics par bien. Référence : la fiche du bien dans `02. Projets/01. Perso/Immobilier Direct/[Bien].md` doit contenir une section `## Diagnostics` avec date d'établissement et date d'expiration de chacun. Si la fiche bien n'a pas cette section, signaler à Thomas et l'aider à la créer avant génération de tout nouveau bail.
```

### Autres ajouts mineurs (même skill)

- Dans § 5.3 « Cas particuliers connus », ajouter :
  ```markdown
  - **Bail étudiant 9 mois** (loi ALUR) — non géré ; la durée par défaut est 1 an tacite reconduction. Si Thomas demande un bail étudiant, override manuel via `--duree 9-mois` (à implémenter côté script si besoin).
  - **Garantie VISALE / Loca-Pass** — alternative au cautionnement personnel ; non gérée dans le bail générique. Si le locataire en bénéficie, Thomas ajoute la mention manuellement après génération.
  ```

---

## 2. `fiche-candidat` (RGPD conservation + cycle de vie)

**fileId** : `1C6_q1npx6JkL0pKz3qrsSMJ_Wdrz8iC5`
**Sévérité** : 🟡 amélioration — conformité RGPD candidat.

### Trous identifiés

1. Pas de règle de **conservation RGPD** des fiches de candidats non retenus.
2. Le cycle « non retenue / abandonnée » dit « archiver ou supprimer selon le choix de Thomas » — règle par défaut absente.
3. Aucun rappel explicite « pas d'accusé de réception automatique ».

### À insérer

> Enrichir **§ 5.3 Cycle de vie** :

```markdown
### 5.3 Cycle de vie

- **Candidature** : fiche dans `_Candidats/`, `statut: candidat`.
- **Signature du bail** : déplacer vers `01. Actuels/`, retirer `statut: candidat`, compléter les champs d'état civil et de bail → fiche prête pour le workflow Baux.
- **Non retenue / abandonnée — conservation RGPD** : la fiche est déplacée dans `_Candidats/_Archive/` avec ajout d'un champ frontmatter `date_archivage: <AAAA-MM-JJ>` et `motif_archivage: <non retenu | abandonné | sans réponse>`. **Durée de conservation par défaut : 24 mois** à compter du dernier contact (cf. recommandation CNIL — gestion des candidatures locatives). Au-delà : suppression définitive (Thomas valide la suppression en lot une fois par an, via le skill `traite-inbox` ou manuellement).

  Cette règle s'applique sauf demande explicite du candidat de suppression immédiate (droit RGPD à l'effacement) — auquel cas Thomas archive la demande dans `09. Administratif/RGPD/` et supprime la fiche.

- **Donnée sensible RGPD** : nationalité, date de naissance, situation professionnelle sont des données personnelles ; ne jamais les republier hors du vault. Le champ `notes` ne doit contenir aucune information discriminatoire (cf. red line 4).
```

> Ajouter **red line 6** (à la suite des 5 existantes en § 5.1) :

```markdown
6. **Pas d'accusé de réception automatique** — la création/MAJ de la fiche est silencieuse côté candidat. Si Thomas veut répondre au candidat, il utilise la skill `draft-email` séparément.
```

---

## 3. `quittance` (paiement partiel + récap annuel LMNP)

**fileId** : `1bs4rhpJAhO_g4UaShsVzIsR00eIks-Xt`
**Sévérité** : 🟡 amélioration opérationnelle.

### Trous identifiés

1. Le cas **paiement partiel** est nommé (Nzioka Mutheu en § 5.3) mais la **mécanique de génération** n'est pas décrite : génère-t-on une quittance "partielle" ? Une note de paiement ? Rien ?
2. Le **récap annuel LMNP** est trigger-référencé (« quittances pour le bilan LMNP 2025 ») mais le format de sortie est-il différent d'un batch de 12 quittances mensuelles ?

### À insérer

> Nouvelle sous-section **§ 5.5 Paiement partiel et récap annuel** (après § 5.4, avant § Contenu du bundle).

```markdown
### 5.5 Paiement partiel — mécanique

Une **quittance de loyer atteste un paiement intégral** (loi 89-462 art. 21). En cas de paiement partiel, deux options :

- **Option A — Reçu pour solde partiel** : ne pas générer de quittance ; produire à la place un **reçu de paiement partiel** qui mentionne le montant reçu, la période concernée, et le solde restant dû. Le script ne supporte pas nativement ce format ; à rédiger manuellement par Thomas le temps qu'une variante `--partiel` soit ajoutée au moteur.
- **Option B — Quittance après régularisation** : attendre que le locataire ait soldé son loyer (cumul des paiements partiels = loyer + charges), puis générer la quittance du mois normalement. C'est l'option par défaut si Thomas ne précise rien.

**Red line** : ne **jamais** délivrer de quittance pour un montant supérieur au paiement effectivement reçu. La quittance est une attestation, pas un engagement.

### 5.6 Récap annuel LMNP

Pour le bilan LMNP, Thomas demande typiquement « quittances janvier à décembre pour [locataire] ». Comportement attendu :

- **Format de sortie** : 12 quittances individuelles (1 PDF par mois), **pas** une quittance annuelle agrégée. La quittance annuelle n'a pas de valeur fiscale — c'est la suite des 12 quittances mensuelles qui constitue la pièce justificative pour le bilan.
- **Brouillon Gmail** : si Thomas demande l'envoi groupé, créer **un seul brouillon** avec les 12 PDF en pièces jointes, variante `plage-neutre` (sauf si `tutoiement: true` → `plage-direct`).
- **Vérification paiement** : pour un bilan annuel, vérifier dans Tiime que les 12 mois ont bien été payés. Si un mois est impayé, signaler dans le récap au lieu de générer la quittance correspondante.
```

---

## 4. `draft-email` (threading, newsletters, pièces jointes)

**fileId** : `1CwZhskb9Cn29kSY0iy-9Fb6vo0WzvVQ8`
**Sévérité** : 🟡 amélioration qualité conversationnelle.

### Trous identifiés

1. Pas de gestion **threading email** (reply vs reply-to-all, headers `In-Reply-To` / `References`).
2. Pas de gestion des **newsletters / mailings promotionnels** (en plus du spam).
3. Pas de mention « pas de pièce jointe sauf demande explicite ».
4. Cascade « Re: Re: Re: » non traitée.

### À insérer

> Enrichir **§ 1 Hors trigger** :

```markdown
### Hors trigger

- Jamais d'envoi automatique — la skill produit un brouillon, point.
- Email de spam → pas de brouillon.
- **Newsletter, mailing promotionnel, notification automatique** (Stripe, Calendly, Notion, GitHub, etc.) → pas de brouillon non plus. Signaux : `noreply@`, `no-reply@`, `notifications@`, `mailer@`, `donotreply@`, expéditeur de type service transactionnel.
- **Email de remerciement court** sans question ni action attendue → pas de brouillon (Thomas a déjà accusé réception en lisant).
```

> Nouvelle sous-section **§ 5.4 Threading et fil de discussion** (après § 5.3 Exemple) :

```markdown
### 5.4 Threading et fil de discussion

- **Reply vs Reply-to-all** : par défaut, répondre à l'expéditeur seul. Si l'email source a plusieurs destinataires en `To:` ou `Cc:` ET que la réponse les concerne aussi (décision collective, RDV multi-parties), utiliser **reply-to-all**. Sinon, reply simple. En cas de doute, demander à Thomas.
- **Headers `In-Reply-To` / `References`** : le connecteur Gmail les pose automatiquement quand on répond à un thread existant. Vérifier que le brouillon est bien rattaché au bon thread (le record `threadId` du message d'origine doit être préservé).
- **Cascade `Re: Re: Re:`** : Gmail ajoute `Re: ` à chaque réponse — au-delà de `Re: Re:`, normaliser à un seul `Re: ` (Gmail le fait nativement pour la suite du thread).
- **Pas de pièce jointe** sauf demande explicite de Thomas (« joins le PDF X », « avec le bail en attaché »). La skill ne joint pas automatiquement le contenu d'un email source ou d'une fiche vault.
- **Pas de signature image / pièce jointe signature** — signature texte uniquement (« Thomas Issa »).
```

---

## 5. `fin-de-bail` (cas litigieux + mode envoi)

**fileId** : `1sMMNeKx04AzJZKpHt13rK9WXQ4Dbp_Td`
**Sévérité** : 🟢 amélioration mineure.

### Trous identifiés

1. Gestion du **cas litigieux** (locataire parti mais impayés ou litige dépôt) non couverte.
2. Pas de recommandation **mode d'envoi** de l'attestation au locataire.

### À insérer

> Enrichir **§ 5.1 Red lines** avec une 6e red line :

```markdown
6. **L'attestation certifie le départ, rien d'autre** — pas de mention d'impayés, de litige sur le dépôt de garantie, de réserves sur l'état des lieux de sortie. Si Thomas demande une attestation alors que le départ est conflictuel, signaler la friction et demander : « Confirmer une attestation simple (départ certifié) ou attendre la résolution du litige ? ». Par défaut, **ne pas certifier** un départ contesté sans validation explicite.
```

> Nouvelle sous-section **§ 5.4 Mode de transmission** (après § 5.3 Exemple) :

```markdown
### 5.4 Mode de transmission

- L'attestation est généralement transmise au **locataire qui l'a demandée** (pour son assurance, sa banque, son futur bailleur). Mode standard : **email simple** depuis Gmail (skill `draft-email` séparée, PDF en pièce jointe).
- En cas de **litige** (cf. red line 6) ou de demande institutionnelle (notaire, avocat, tribunal), recommander à Thomas un **envoi en LRAR** — la skill ne gère pas l'envoi LRAR, c'est manuel.
- L'attestation est une **certification post-départ** : elle reste valable indéfiniment, sans expiration. Si le locataire en demande une copie 5 ans après son départ, la regénérer à la même date d'émission (pas de re-datation).
```

---

## 6. `traite-inbox` (fichiers corrompus + photos post-transfert)

**fileId** : `1LHtkZAszA0K1EGOr1Jq_4wXqqsDS9093`
**Sévérité** : 🟢 amélioration résilience.

### Trous identifiés

1. Pas de gestion explicite **fichier corrompu / illisible** (PDF tronqué, image bug, vocal `.ogg` sans header valide).
2. Photos source non supprimées de `_Inbox/Photos/` après transfert (la quarantaine `_Traité/` les conserve — OK pour traçabilité mais grossit indéfiniment).

### À insérer

> Enrichir **§ 5.1 Red lines** avec une 12e red line :

```markdown
12. **Fichier illisible** — si une source ne peut être lue (PDF tronqué, image corrompue, vocal `.ogg` sans header, transcript Plaud vide) : ne pas planter, ne pas inventer le contenu. Déplacer le fichier vers `_Inbox/_Traité/_Corrompus/` et signaler dans la section « Anomalies » du récap : « Fichier illisible — [nom] — [raison probable] — à inspecter manuellement ».
```

> Nouvelle sous-section **§ 5.15 Cycle de vie quarantaine** (après § 5.14 Lock) :

```markdown
### 5.15 Cycle de vie de la quarantaine `_Traité/`

`_Inbox/_Traité/` grossit à chaque session — sources Plaud / Photos / Vocal y sont déposées après traitement, sans suppression automatique (cf. red line 3 : quarantaine avant suppression).

**Purge annuelle proposée** : une fois par an, Thomas valide une purge des fichiers `_Traité/` antérieurs à 12 mois (script externe à la skill, ou opération manuelle). La purge ne porte que sur les fichiers source — les fiches markdown créées dans le vault ne sont jamais touchées.

**Sous-dossier `_Traité/_Corrompus/`** (créé par red line 12) : à ne jamais purger automatiquement — ces fichiers méritent une inspection manuelle.

**Limite Drive** : `_Traité/` peut représenter plusieurs Go (photos + vidéos iPhone). Si Thomas approche la limite Drive (suite à un export massif Plaud, par exemple), proposer une purge ciblée par mois.
```

---

## VALIDATION POST-ÉDITION (chaque skill)

1. **Re-lire** le SKILL.md après PATCH via `read_file_content` pour confirmer que le contenu ajouté y est bien.
2. **Vérifier le frontmatter** : `name: <skill>` et `description: "..."` toujours présents et YAML valide.
3. **Vérifier la cohérence des références croisées** : si tu ajoutes une § 5.X, tu peux référencer § 5.X depuis ailleurs sans casser les wikilinks `[[...]]` existants.
4. **Demander à Thomas la validation visuelle dans Obsidian** — R6 : ne jamais conclure « ça marche » après 1 test technique côté Drive.
5. **Tailles cibles** (après enrichissement) :
   - `baux` : ~12 KB → ~15 KB (annexes + cas particuliers)
   - `fiche-candidat` : ~7 KB → ~8.5 KB (RGPD)
   - `quittance` : ~10 KB → ~12 KB (paiement partiel + LMNP)
   - `draft-email` : ~7 KB → ~9 KB (threading + newsletters)
   - `fin-de-bail` : ~7 KB → ~8 KB (cas litigieux)
   - `traite-inbox` : ~28 KB → ~30 KB (corrompus + cycle vie)

---

## OUT OF SCOPE

- Ne **pas modifier** `cr-reunion` (déjà enrichi, validé S21).
- Ne **pas créer** de nouveaux skills (auto-provisioning, no-match flow, etc.).
- Ne **pas toucher** aux scripts dans les bundles `08. Outils/Skills/<skill>/scripts/` — ce sont du code Anya, modifiés côté repo seulement.
- **RGPD vault global** (conservation des fiches contact créées par `traite-inbox`) : c'est une politique transverse à traiter au niveau `CLAUDE.md` racine vault, pas dans chaque skill. À ajouter au backlog Thomas, hors de cette mission.

---

## DEMANDE FINALE

1. PATCH chaque skill dans l'ordre recommandé (baux d'abord).
2. Après chaque PATCH, propose-moi un diff (avant / après) en preview AVANT le commit définitif.
3. Si tu détectes un conflit (Thomas a déjà ajouté quelque chose qui chevauche), signale-le et propose la fusion plutôt que d'écraser.
4. Une fois les 6 PATCH faits, demande à Thomas la validation visuelle dans Obsidian.
5. Ensuite l'orchestrator (côté repo Anya) resynchronisera les fallbacks repo `docs/ia/skills/<skill>/SKILL.md` pour préserver R7 (fallback = copie alignée du SOT vault).

Si MCP Drive est indispo ou OAuth expiré, STOP et signale à Thomas — ne pas inventer le contenu vault, R1 zéro invention.
