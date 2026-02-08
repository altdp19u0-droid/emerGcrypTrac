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

### 2025-02-08
- ✅ Terminé: Fonctionnalité "Vérification des Transactions Manquantes"
  - Bouton "Vérifier" sur chaque wallet
  - Dialog avec liste des transactions manquantes
  - Checkboxes + import sélectif
  - Endpoints: `GET /wallets/{id}/verify-transactions`, `POST /wallets/{id}/import-missing`

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
