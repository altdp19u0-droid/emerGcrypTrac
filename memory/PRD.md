# CryptoTrack - Product Requirements Document

## Original Problem Statement
Application de suivi de portfolio crypto avec gestion des comptes Fiat intégrée.

## Mise à jour (06/02/2026)

### Fonctionnalités Transactions

#### Transactions Fiat
- ✅ Comptes Fiat avec format comptable (Débit/Crédit/Solde)
- ✅ Origine/Destination pour chaque transaction
- ✅ **Modification des transactions Fiat**
- ✅ **Suppression des transactions Fiat**

#### Transactions Crypto
- ✅ Sync multi-chaînes (ETH, Polygon, Arbitrum, Base, Optimism)
- ✅ **Modification des transactions manuelles** (source=manual/csv_import)
- ✅ **Suppression des transactions**
- ✅ Protection: transactions blockchain non modifiables

### Tableau Récapitulatif

| Type | Page | Modifier | Supprimer |
|------|------|----------|-----------|
| Fiat | Fiat | ✅ | ✅ |
| Crypto Manuel | Transactions | ✅ | ✅ |
| Crypto Blockchain | Transactions | ❌ (protégé) | ✅ |

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
- ✅ Modification des transactions Fiat
- ✅ Suppression des transactions Fiat
- ✅ **Modification des transactions Crypto manuelles**
- ✅ **Suppression des transactions Crypto**
- ✅ P&L Calculator
- ✅ Export PDF/CSV

## Compte de Test
- **Username**: fiatdemo
- **Password**: FiatDemo123
- **Compte Fiat**: "Banque Principale"
- **Wallet Test**: "Wallet Manuel Test"

## Backlog
### P1
- Historique des modifications (audit trail)
- Rapport de rapprochement bancaire Fiat/Crypto
- Alertes de prix

### P2
- Support nouvelles chaînes
- Intégration exchanges
- Fonction Dupliquer transaction
- Fonction Undo après suppression
