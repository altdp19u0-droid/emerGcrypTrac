# CryptoTrack - Product Requirements Document

## Original Problem Statement
Application de suivi de portfolio crypto avec gestion des comptes Fiat intégrée.

## Améliorations Fiat (06/02/2026)

### Nouvelle Architecture Fiat
1. **Origine/Destination pour chaque transaction**
   - Source : Banque fiat (compte_id) | Wallet crypto (wallet_id + adresse) | Externe
   - Destination : Banque fiat | Wallet crypto | Externe
   - Champs: source_type, source_account_id, source_wallet_id, source_wallet_address, source_name
   - Champs: dest_type, dest_account_id, dest_wallet_id, dest_wallet_address, dest_name

2. **Format comptable**
   - Colonne Débit (montant négatif)
   - Colonne Crédit (montant positif)
   - Colonne Solde courant (running_balance)

3. **Intégration page Transactions**
   - Paramètre `include_fiat=true` pour combiner crypto + fiat
   - Colonne "Catégorie" (Fiat/Crypto)
   - Filtre par comptes fiat

## Stack Technique
- **Frontend**: React.js + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: FastAPI (Python) avec JWT Auth
- **Database**: MongoDB
- **APIs externes**: CoinGecko, Etherscan V2, Blockscout

## What's Been Implemented
- ✅ Authentification JWT
- ✅ Dashboard portfolio multi-chaînes
- ✅ Wallets (ETH, Polygon, Arbitrum, Base, Optimism)
- ✅ Transactions crypto avec sync blockchain
- ✅ **Comptes Fiat avec origine/destination**
- ✅ **Tableau comptable Débit/Crédit/Solde**
- ✅ **Transactions Fiat dans page Transactions**
- ✅ P&L Calculator
- ✅ Export PDF/CSV

## Compte de Test
- **Username**: fiatdemo
- **Password**: FiatDemo123
- **Compte Fiat**: "Banque Principale" avec 3000€

## Backlog
### P1
- Rapport de rapprochement bancaire Fiat/Crypto
- Alertes de prix

### P2
- Support nouvelles chaînes
- Intégration exchanges
