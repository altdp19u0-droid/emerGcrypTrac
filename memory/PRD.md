# CryptoTrack - Product Requirements Document

## Original Problem Statement
Application de suivi de portefeuille crypto/fiat pour le calcul des impôts. Focus sur les opérations on-ramp/off-ramp (Prime neverless, Bleap wallet) pour convertir EUR ↔ crypto (EURC, USDC, etc.).

## User Persona
- Utilisateur techniquement compétent
- Besoin de traçabilité fiscale complète
- Utilise plusieurs wallets sur différentes chaînes (Ethereum, Polygon, Base, Arbitrum, Optimism)
- Langue préférée: Français

## Core Requirements

### Wallets & Synchronisation
- [x] Gestion multi-wallets (blockchain + manuels)
- [x] Synchronisation via Etherscan API (ETH, Polygon, Arbitrum)
- [x] Synchronisation via Blockscout (Base, Optimism) - gratuit
- [x] **Vérification des transactions manquantes** avec import manuel

### Transactions Crypto
- [x] Types: Buy, Sell, Transfer In, Transfer Out
- [x] Libellé/Catégorie (Interest, Yield, Airdrop, Fees, etc.)
- [x] Classification des adresses (trusted/suspect)
- [x] Double-entry pour transferts internes
- [x] Récupération des frais de gas manquants
- [x] Export CSV avec filtres

### Transactions Fiat
- [x] Comptes fiat multiples
- [x] Achat/Vente crypto depuis fiat (liaison automatique)
- [x] Dépôts/Retraits

### Rapports & Fiscalité
- [x] Page Rapports avec calcul P&L (méthode FIFO)
- [x] Export PDF fiscal
- [x] Page P&L détaillée

## Tech Stack
- **Backend**: FastAPI, MongoDB, Pydantic
- **Frontend**: React, TypeScript, Vite, Shadcn UI, Tailwind CSS
- **APIs**: CoinGecko (prix), Etherscan, Blockscout

## Credentials Test
- Username: `fiatdemo`
- Password: `FiatDemo123`

---

## Changelog

### 2025-02-08 (Session actuelle)
- ✅ **Amélioration affichage DeFi - Assets 100% rewards**
  - Problème: Pour 8LNDS (sans dépôt), l'affichage `+€18,446 | Net: €18,446` était redondant
  - Solution: Nouvel affichage `Valeur: €18,446 (100% rewards)` pour les assets sans dépôts
  - Les assets avec dépôts (USDC) conservent l'affichage `+€X | Net: €Y`

- ✅ **Bug fix vérifié: Affichage valeur EUR DeFi**
  - Le bug signalé: la valeur "Net" pour 8LNDS affichait la quantité de tokens (2005.009) au lieu de la valeur EUR (€18.45)
  - Vérification: Le bug a été corrigé, l'affichage est maintenant correct
  - Test réussi: 100% backend, 100% frontend

### 2025-02-08 (Sessions précédentes)
- ✅ **Page DeFi - Suivi automatisé des positions**
  - Nouvelle page "/defi" pour suivre les investissements DeFi
  - Auto-catégorisation des transactions par protocole
  - Calcul automatique ROI, dépôts, rewards, retraits
  - Support initial: 8LENDS Lending
  - Endpoints: `/api/defi/positions`, `/api/defi/auto-categorize`, `/api/defi/position/{protocol}`

- ✅ Terminé: Fonctionnalité "Vérification des Transactions Manquantes"
  - Bouton "Vérifier" (icône œil) sur chaque wallet blockchain
  - Dialog avec liste des transactions manquantes + checkboxes
  - Import sélectif des transactions
  - **Support de TOUS les réseaux** :
    - Base, Optimism via Blockscout (gratuit)
    - Ethereum, Polygon, Arbitrum via Etherscan V2 (clé API requise)
  - Message clair quand clé API manquante
  - Lien explorer dynamique selon le réseau
  - Endpoints: `GET /wallets/{id}/verify-transactions`, `POST /wallets/{id}/import-missing`

- ✅ Bug fix: Calcul portfolio incorrect ($152k → $6.6k)
  - Les montants étaient doublement comptés (signés + type)
  - Corrigé pour utiliser uniquement les montants signés

- ✅ Système de gestion des tokens SPAM
  - Détection automatique via patterns (t.me, claim, airdrop, caractères cyrilliques, etc.)
  - Interface de gestion dans le Dashboard (bouton "Spam")
  - Onglets: Liste spam + Prévisualisation
  - Actions: Scanner, Marquer/Retirer du spam
  - 168 transactions spam marquées, 76 tokens spam détectés
  - Endpoints: `/api/spam-tokens/*`

- ✅ Interface de gestion des prix manquants
  - Bouton "Prix Manquants" sur page Transactions
  - Liste tokens sans prix avec saisie manuelle
  - Auto-fetch via DeFiLlama
  - Endpoints: `/api/transactions/set-token-price`, `/api/transactions/tokens-without-prices`
  - Tests: 8LNDS (38 tx), ZCHF (23 tx) mis à jour

### Précédemment implémenté
- Flux Achat/Vente Crypto depuis Fiat
- UI Transactions: colonnes Source/Destination corrigées, Libellé ajouté
- Classification adresses avec icônes copy/explorer
- Bug fix page Rapports
- Export CSV avec filtres
- Récupération frais de gas
- Double-entry transferts internes
- Marquage auto wallets utilisateur comme "trusted"

---

## Roadmap / Backlog

### P0 - Critique
- Aucun (fonctionnalités critiques terminées)

### P1 - Important
- [ ] Refactoring `server.py` (>4600 lignes) en modules séparés
- [ ] Améliorer robustesse sync blockchain automatique
- [ ] Alertes automatiques transactions manquantes

### P2 - Nice to have
- [ ] Dashboard amélioré avec graphiques P&L
- [ ] Notifications email pour grosses transactions
- [ ] Support d'autres chaînes (Gnosis, BSC, etc.)
- [ ] Récupération automatique des prix historiques journaliers (CoinGecko/DeFiLlama)
- [ ] Représentation des positions DeFi comme actif virtuel unique sur la page "Positions"
