# CryptoTrack - Product Requirements Document

## Original Problem Statement
Application de suivi de portfolio crypto avec gestion des comptes Fiat intégrée.

## Mise à jour (06/02/2026)

### Fonctionnalités Fiat
1. **Comptes Fiat avec format comptable**
   - Colonnes Débit/Crédit/Solde courant
   - Origine/Destination pour chaque transaction

2. **NOUVEAU: Modification des transactions** ✅
   - Bouton Modifier (crayon) dans colonne Actions
   - Dialog d'édition pré-rempli
   - Modification de: Type, Montant, Description, Date/Heure, Origine, Destination
   - Mise à jour automatique du solde

3. **NOUVEAU: Suppression des transactions** ✅
   - Bouton Supprimer (poubelle) dans colonne Actions
   - Confirmation avant suppression
   - Ajustement automatique du solde

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
- ✅ Comptes Fiat avec origine/destination
- ✅ Tableau comptable Débit/Crédit/Solde
- ✅ Transactions Fiat dans page Transactions
- ✅ **Modification des transactions Fiat**
- ✅ **Suppression des transactions Fiat**
- ✅ P&L Calculator
- ✅ Export PDF/CSV

## Compte de Test
- **Username**: fiatdemo
- **Password**: FiatDemo123
- **Compte Fiat**: "Banque Principale" avec ~3000€

## Backlog
### P1
- Historique des modifications (audit trail)
- Rapport de rapprochement bancaire Fiat/Crypto
- Alertes de prix

### P2
- Support nouvelles chaînes
- Intégration exchanges
- Fonction Undo après suppression
