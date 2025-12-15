# Service de gestion de patrimoine – Backend

Ce projet est un **prototype backend NestJS** permettant de consolider le patrimoine financier d’un utilisateur à partir d’événements financiers envoyés par des sources externes hétérogènes (banques, plateformes crypto, assureurs).

Le système est conçu pour fonctionner dans un contexte réaliste de **webhooks imparfaits** : événements incomplets, dupliqués, reçus hors ordre, ou corrigés a posteriori.  
L’objectif principal est de produire une **vue cohérente, réconciliée et exploitable du patrimoine** à partir de ces flux.

---

## Choix techniques

- **NestJS / TypeScript**  
  Choisi pour sa structuration modulaire, sa testabilité et son adéquation avec des APIs backend complexes.

- **Normalisation + Réconciliation**  
  Séparation claire entre :
  - l’ingestion des événements,
  - leur normalisation,
  - et la réconciliation pour produire une vue cohérente.

- **Zod pour la validation**  
  Utilisé pour une validation minimale en entrée, adaptée aux webhooks imparfaits.

- **Stockage en mémoire**  
  Suffisant pour un prototype, permettant de se concentrer sur la logique métier.

## Architecture générale

L’architecture repose sur une séparation claire des responsabilités :

- **Ingestion**  
  Réception des événements externes via des endpoints dédiés par provider.

- **Validation minimale**  
  La validation en entrée vérifie uniquement les champs nécessaires à l’identification et au routage de l’événement.  
  Les champs métier (montants, type d’opération, devise…) peuvent être absents.

- **Normalisation**  
  Chaque payload externe est transformé en un modèle interne unifié (`NormalizedEvent`), indépendant du format d’origine.

- **Réconciliation**  
  Une couche dédiée assure la cohérence globale des données :
  - idempotence,
  - gestion des corrections,
  - gestion des événements incomplets,
  - prise en compte des événements reçus en retard.

- **Read model**  
  Les données réconciliées sont exposées via une API permettant d’accéder au solde global, au détail par compte et à une timeline consolidée.

### Backend helpers (pipes & logging)

- Validation pipe for schemas: `backend/src/_common/pipes/zod-validation.pipe.ts` lets you plug Zod schemas directly in controllers, e.g. `@Body(new ZodValidationPipe(MySchema)) payload`.
- Request logging: `backend/src/_common/interceptors/logging.interceptor.ts` adds structured logs per request; enabled globally in `backend/src/main.ts`.
- Structured logging config: Winston is wired with Datadog-friendly formatter in `backend/src/_common/logging.ts`, configured in `backend/src/app.module.ts`.

---

## Modèle d’événement unifié

Tous les événements sont normalisés dans un format commun, contenant notamment :

- **Identification**
  - `userId`
  - `sourceType` (`BANK`, `CRYPTO`, `INSURER`)
  - `sourceName` (BNP, Coinbase, AXA…)
  - `sourceEventId` (txnId, id externe…)

- **Données métier**
  - `accountId`
  - `timestamp`
  - `eventType`

- **Fiat**
  - `amount`
  - `currency`

- **Crypto**
  - `asset`
  - `assetAmount`
  - `fiatValue` (estimation fournie par la plateforme)

- **Métadonnées de cohérence**
  - `dedupeKey`
  - `fingerprint`
  - `completenessScore`
  - `status` (`VALID`, `INCOMPLETE`, `DUPLICATE`, `SUPERSEDED`)

- **Traçabilité**
  - `raw` (payload original)

---

## DedupeKey et Fingerprint

### DedupeKey – identité logique

Le `dedupeKey` représente l’identité stable d’une transaction externe :

Il permet de garantir l’idempotence et d’identifier les retries webhook.

### Fingerprint – version de contenu

Le `fingerprint` est un hash des champs métier significatifs (montant, type, asset, timestamp, etc.).

Il permet de distinguer :

- un **retry strict** (contenu identique),
- d’une **correction ou mise à jour** (contenu différent pour la même transaction).

---

## Réconciliation des événements

Lors de l’ingestion d’un événement :

1. **Nouvel événement (dedupeKey inconnu)**  
   L’événement est stocké et marqué `VALID` ou `INCOMPLETE` selon sa complétude.

2. **Retry identique (fingerprint identique)**  
   L’événement est marqué `DUPLICATE` et ignoré pour les calculs.

3. **Correction ou mise à jour (fingerprint différent)**  
   Les deux versions de l’événement sont comparées afin de déterminer laquelle est la plus fiable :
   - Une version `VALID` est toujours prioritaire sur une version `INCOMPLETE`
   - À statut égal, la version avec le **score de complétude le plus élevé** est retenue
   - En cas d’égalité, la règle _last write wins_ est appliquée

   - Si la nouvelle version est jugée **plus fiable**, elle remplace l’ancienne,  
     qui est alors marquée `SUPERSEDED`
   - Si la nouvelle version est **moins complète ou moins fiable**, elle est ignorée  
     et l’événement existant reste la version de référence

### Sélection de la version gagnante

La décision repose sur :

1. `VALID` prioritaire sur `INCOMPLETE`
2. Score de complétude le plus élevé (`completenessScore`)
3. En cas d’égalité : _last write wins_

---

## Gestion des événements incomplets

Les événements incomplets sont :

- acceptés par l’API,
- stockés et visibles dans la timeline,
- exclus des calculs de solde tant qu’ils ne sont pas complétés.

Ce choix permet de refléter fidèlement le comportement réel des flux webhook.

---

## Spécificité des événements crypto

Pour les événements crypto :

- `asset` et `assetAmount` représentent la position réelle,
- `fiatValue` correspond à une estimation fournie par la plateforme au moment de la transaction.

`fiatValue` n’est **pas assimilé à une valorisation actuelle du portefeuille** et est exposé à titre informatif uniquement.  
Une valorisation temps réel nécessiterait un service de pricing externe, hors périmètre de ce prototype.

---

## API exposée

### Ingestion

- `POST /webhooks/bankx`
- `POST /webhooks/crypto`
- `POST /webhooks/insurer`

### Lecture du patrimoine

- `GET /wealth/{userId}/balance`
- `GET /wealth/{userId}/accounts`
- `GET /wealth/{userId}/timeline`

---

## Tests

Des tests end-to-end (Jest + Supertest) couvrent les cas principaux :

- déduplication des événements,
- corrections et mises à jour,
- événements incomplets,
- événements reçus hors ordre chronologique.

---

## Limites de la solution

- Pas de persistance en base de données
- Pas de valorisation crypto en temps réel
- Pas de gestion multi-devises
- Pas de mécanisme de correction manuelle
- Pas de gestion de concurrence ou de scalabilité

---

## Améliorations possibles avec plus de temps

- Persistance des événements (PostgreSQL + index sur dedupeKey)
- Intégration d’un service de pricing pour les actifs crypto
- Support multi-devises et taux de change
- Gestion avancée des conflits (priorité par source, versioning)
- Monitoring et métriques (latence, taux de duplication)

Ces limites sont assumées afin de concentrer l’exercice sur la **logique de réconciliation et de cohérence des données**.

## Lancer le projet en local

### Prérequis

- Node.js >= 18
- pnpm

### Installation

pnpm install

### Lancer l'application

pnpm run dev

### Lancer les tests end-to-end

pnpm run test:e2e

---
