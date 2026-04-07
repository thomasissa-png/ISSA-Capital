# Checklist RGPD opérationnelle — ISSA Capital
> @legal — 2026-04-07
> Base légale : RGPD (UE) 2016/679, Loi Informatique et Libertés modifiée (LIL), Recommandations CNIL
> Livrables amont consultés : project-context.md, docs/product/product-vision.md, docs/legal/legal-audit.md

---

## Résumé exécutif

- **Objectif** : Cartographier et sécuriser le seul traitement de données d'ISSA Capital — le formulaire de contact
- **Décisions clés** : Base légale = consentement ; pas de DPO obligatoire ; pas de données sensibles au sens art. 9 RGPD
- **Dépendances** : @fullstack (mention RGPD formulaire, politique confidentialité), @data-analyst (tracking plan Plausible)

---

## 1. Cartographie des traitements — Registre simplifié

ISSA Capital V1 opère **un seul traitement de données personnelles**.

### Traitement T1 — Formulaire de contact / propositions d'investissement

| Champ | Valeur |
|---|---|
| **Identifiant** | T1 |
| **Nom du traitement** | Réception et traitement des propositions et demandes de contact |
| **Responsable du traitement** | ISSA Capital — SAS — 54 Rue Henri Barbusse, 92000 Nanterre |
| **Contact** | Thomas Issa — [adresse email à préciser par Thomas] |
| **Finalité principale** | Traiter les propositions d'opportunités d'investissement et demandes de contact adressées à ISSA Capital |
| **Base légale** | Consentement de la personne concernée (art. 6.1.a RGPD) — la personne remplit volontairement le formulaire et soumet sa demande |
| **Catégories de personnes concernées** | Fondateurs de PME, partenaires B2B, tout tiers prenant contact via le formulaire |
| **Données collectées** | Nom, prénom, adresse email, contenu du message (libre — peut contenir des informations sur l'activité, le CA, le projet de cession) |
| **Données particulières (art. 9 RGPD)** | AUCUNE — les données financières d'une entreprise (CA, capital, valorisation) ne sont pas des données sensibles au sens de l'art. 9 RGPD |
| **Destinataires** | Thomas Issa et dirigeants habilités d'ISSA Capital |
| **Sous-traitants** | Resend Inc. (service d'envoi d'emails transactionnels) — DPA à signer avec Resend |
| **Transferts hors UE** | Possible via Resend (entreprise américaine) — à vérifier clauses contractuelles types (CCT) ou Privacy Framework UE-USA |
| **Durée de conservation** | 3 ans maximum à compter de la soumission du formulaire |
| **Mesures de sécurité** | Transmission chiffrée (HTTPS/TLS obligatoire), accès restreint aux seuls destinataires nommés, aucun stockage en base de données (email direct via Resend) |

### Traitement T2 — Mesure d'audience (Plausible Analytics)

| Champ | Valeur |
|---|---|
| **Identifiant** | T2 |
| **Nom du traitement** | Mesure d'audience anonymisée |
| **Outil** | Plausible Analytics |
| **Données personnelles collectées** | AUCUNE — Plausible ne collecte pas de données personnelles identifiables, ne dépose pas de cookies |
| **Base légale** | Sans objet — pas de données personnelles |
| **Obligations RGPD** | AUCUNE — traitement hors champ RGPD |
| **Obligations CNIL cookies** | AUCUNE — outil cookieless, aucun consentement requis |

---

## 2. Mention RGPD obligatoire au-dessus du formulaire

### Base légale

Article 13 RGPD : obligation d'informer la personne au moment de la collecte.

### Texte prêt à coller (au-dessus du bouton Envoyer du formulaire)

```
Les informations que vous transmettez via ce formulaire sont collectées par ISSA Capital
(SAS, 54 Rue Henri Barbusse, 92000 Nanterre) pour traiter votre demande ou proposition.

Elles sont destinées aux dirigeants d'ISSA Capital et conservées 3 ans maximum.

Vous pouvez exercer vos droits d'accès, de rectification et de suppression en écrivant à
[adresse email privacy — ex. privacy@issa-capital.com].

Pour en savoir plus, consultez notre politique de confidentialité.
[Lien vers /mentions-legales#confidentialite ou /politique-de-confidentialite]
```

**Contrainte de mise en forme (@fullstack)** : ce texte doit être visible AVANT que l'utilisateur soumette le formulaire — pas après, pas dans un modal caché. Taille minimum recommandée : 12px, couleur lisible sur fond.

---

## 3. Registre des traitements — Modèle interne (usage Thomas)

Le registre des traitements est obligatoire pour les organismes de plus de 250 salariés ou traitant des données sensibles de manière régulière (art. 30 RGPD). ISSA Capital étant une SAS de moins de 250 salariés sans traitement de données sensibles, ce registre n'est **pas légalement obligatoire** en V1.

Il est néanmoins **fortement recommandé** comme bonne pratique (preuve de conformité en cas de contrôle CNIL).

### Modèle de registre (Markdown — à tenir à jour par Thomas)

```markdown
# Registre des traitements — ISSA Capital
Dernière mise à jour : 2026-04-07
Responsable du traitement : ISSA Capital — Thomas Issa

## T1 — Formulaire de contact
- Finalité : traitement des propositions et demandes de contact
- Base légale : consentement (art. 6.1.a RGPD)
- Catégories de données : identité, email, message
- Personnes concernées : fondateurs PME, partenaires B2B
- Durée conservation : 3 ans
- Destinataires : Thomas Issa (ISSA Capital)
- Sous-traitants : Resend Inc. — DPA signé : [oui/non/en cours]
- Transferts hors UE : Resend (USA) — mécanisme : [CCT / Privacy Framework / à vérifier]
- Mesures de sécurité : HTTPS, accès restreint, pas de base de données

## T2 — Plausible Analytics
- Finalité : mesure d'audience anonymisée
- Base légale : hors champ RGPD (pas de données personnelles)
- Données : aucune donnée personnelle collectée
- Durée conservation : 13 mois (paramètre Plausible par défaut)
```

---

## 4. Procédure d'exercice des droits

### Configuration requise

Thomas doit créer une adresse email dédiée aux demandes RGPD, distincte de l'email de contact général. Proposition : privacy@issa-capital.com.

### Procédure interne (à appliquer par Thomas)

| Étape | Action | Délai |
|---|---|---|
| Réception | Accuser réception de la demande à l'adresse de l'expéditeur | Immédiatement |
| Identification | Vérifier l'identité du demandeur (email = même adresse que la soumission du formulaire) | J+3 maximum |
| Traitement | Exécuter la demande (accès = fournir copie des données ; suppression = effacer l'email reçu) | 1 mois (art. 12.3 RGPD) |
| Confirmation | Confirmer par email l'exécution de la demande | Inclus dans le délai de 1 mois |
| Prorogation | Si la demande est complexe : informer la personne de la prorogation (max 2 mois supplémentaires) | Avant expiration du premier mois |

**Note pratique :** dans le cas d'ISSA Capital V1, les seules données stockées sont dans les emails reçus via Resend. Une suppression = effacer l'email dans la boîte de réception. Aucune base de données à purger.

---

## 5. Spécificité "données financières dans le formulaire"

### Analyse du risque RGPD

Lorsque le formulaire de contact est utilisé pour des "propositions d'investissement", les personnes peuvent transmettre des informations sur leur entreprise : chiffre d'affaires, capital, situation financière, projet de cession.

**Ces données NE SONT PAS des données sensibles au sens de l'article 9 RGPD**, qui couvre exclusivement :
- Données de santé
- Données génétiques ou biométriques
- Opinions politiques, convictions religieuses
- Appartenance syndicale
- Orientation sexuelle
- Données relatives aux infractions pénales

Les informations financières d'une entreprise sont des données personnelles ordinaires si elles permettent d'identifier une personne physique (ex : CA d'une EURL = CA du gérant personne physique = donnée personnelle indirecte).

**Obligations spécifiques malgré l'absence de caractère sensible :**

| Obligation | Détail |
|---|---|
| Sécurité renforcée | Ces données ont une valeur commerciale élevée — chiffrement TLS obligatoire, accès ultra-restreint (Thomas uniquement) |
| Confidentialité | Aucun partage avec des tiers sans consentement explicite de l'émetteur |
| Durée de conservation courte | 3 ans maximum recommandés — les données financières d'un projet non retenu perdent leur utilité rapidement |
| Pas de réutilisation | Les données d'une proposition rejetée ne peuvent pas être utilisées à d'autres fins (démarchage, transmission à un tiers) |

**Recommandation pratique :** Thomas doit s'assurer que les emails reçus via Resend sont stockés dans une boîte email sécurisée (2FA activé, accès individuel) et non dans un outil collaboratif ouvert.

---

## 6. Sous-traitant Resend — DPA obligatoire

### Base légale

Article 28 RGPD : tout sous-traitant qui traite des données personnelles pour le compte du responsable de traitement doit être encadré par un contrat (Data Processing Agreement — DPA).

### Resend et DPA

Resend propose un DPA standard accessible depuis leur espace client. Thomas doit :

1. Se connecter à son compte Resend
2. Accéder aux paramètres légaux / compliance
3. Signer ou accepter le DPA Resend
4. Conserver une copie dans le registre des traitements

**Si Resend est remplacé par un autre service :** même obligation. Tout service d'envoi d'email (Mailgun, SendGrid, Brevo, etc.) doit avoir un DPA signé.

### Transferts hors UE via Resend

Resend est une société américaine. Le transfert de données vers les USA est encadré depuis le Data Privacy Framework UE-USA (décision d'adéquation du 10 juillet 2023, Commission européenne). Vérifier que Resend est certifié Data Privacy Framework : https://www.dataprivacyframework.gov/

---

## 7. Absence d'obligation DPO — Confirmation

### Critères d'obligation (art. 37 RGPD)

Un DPO (Délégué à la Protection des Données) est obligatoire si l'organisme :
- (a) Est une autorité publique : NON
- (b) Effectue à grande échelle un suivi systématique des personnes : NON (aucun tracking, aucun profilage)
- (c) Traite à grande échelle des données sensibles (art. 9) : NON

**Conclusion : ISSA Capital n'est pas soumise à l'obligation de désigner un DPO.**

Thomas assure lui-même la responsabilité RGPD en qualité de responsable du traitement (contact de référence pour les demandes de droits et les éventuels contrôles CNIL).

---

## 8. Checklist de mise en conformité RGPD — Binaire

| # | Obligation | Base légale | Statut |
|---|---|---|---|
| R1 | Politique de confidentialité publiée sur le site (page dédiée ou section mentions légales) | Art. 13 RGPD | En attente (@fullstack) |
| R2 | Lien vers politique de confidentialité accessible depuis chaque page (footer) | Art. 13 RGPD | En attente (@fullstack) |
| R3 | Mention RGPD courte au-dessus du formulaire de contact | Art. 13 RGPD | En attente (@fullstack) |
| R4 | Case à cocher consentement sur le formulaire (ou texte suffisamment clair) | Art. 6.1.a + 7 RGPD | En attente (@fullstack/@ux) |
| R5 | Email privacy dédié créé et opérationnel | Art. 12 RGPD | En attente (Thomas) |
| R6 | DPA Resend signé | Art. 28 RGPD | En attente (Thomas) |
| R7 | Certificat Resend Data Privacy Framework vérifié | Décision adéquation 2023 | En attente (Thomas) |
| R8 | Registre des traitements T1 et T2 rempli et conservé | Art. 30 RGPD (bonne pratique) | En attente (Thomas) |
| R9 | Transmission du site en HTTPS/TLS obligatoire (pas de HTTP) | Art. 32 RGPD | En attente (@infrastructure) |
| R10 | Google Fonts chargées en local (aucun appel CDN Google) | Recommandation CNIL | En attente (@fullstack) |
| R11 | Plausible configuré en mode privacy-first (pas de données IP) | Recommandation CNIL | En attente (@fullstack) |
| R12 | Procédure droits documentée en interne (ce fichier = documentation) | Art. 12 RGPD | FAIT (ce document) |

---

## Hypothèses à valider

| # | Hypothèse | Type | Validé par |
|---|---|---|---|
| H-R1 | Adresse email privacy = privacy@issa-capital.com | Proposition | Thomas |
| H-R2 | Aucune base de données V1 (pas de stockage server-side des soumissions formulaire) | Confirmé product-vision.md | @fullstack |
| H-R3 | Resend est certifié Data Privacy Framework UE-USA | À vérifier | Thomas |
| H-R4 | Durée conservation 3 ans adaptée aux cycles d'investissement d'ISSA Capital | Proposition raisonnable | Thomas (peut ajuster) |

---

*Ce document est un draft opérationnel. Il ne constitue pas un avis juridique formel. Pour une mise en conformité RGPD avancée (ex : en cas d'élargissement des traitements, d'internationalisation, ou de traitement de données sensibles), une consultation auprès d'un DPO certifié ou d'un avocat spécialisé est recommandée.*
