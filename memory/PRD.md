# CryptoTrack - Product Requirements Document

## Original Problem Statement
Application de suivi de portefeuille crypto-fiat "emerGcrypTrac" avec les fonctionnalités suivantes :
- Gestion des comptes Fiat et transactions
- Gestion des wallets crypto et transactions
- Page Positions/Investissements pour DeFi/CeFi
- Export CSV et PDF fiscal
- Double-entry accounting pour les transferts
- Exclusion des transactions spam des rapports

## Application Access
- **URL**: https://fiat-ledger-app.preview.emergentagent.com
- **Test User**: fiatdemo / FiatDemo123

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, lucide-react
- **Backend**: FastAPI, Pydantic, Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT-based

## What's Been Implemented

### Core Features (Completed)
- [x] User authentication (JWT)
- [x] Dashboard with portfolio overview
- [x] Wallet management (CRUD)
- [x] Crypto transactions (CRUD + edit)
- [x] Fiat accounts management (CRUD)
- [x] Fiat transactions (CRUD + edit + delete)
- [x] Positions/Investments page with movements
- [x] P&L Report (FIFO method)
- [x] Spam transaction filtering from P&L
- [x] CSV exports (accounts, transactions, positions)
- [x] PDF fiscal report generation
- [x] Double-entry: Fiat ↔ Fiat transfers
- [x] Double-entry: Fiat → Crypto Wallet transfers

### UI Fixes (Completed)
- [x] Fixed invisible text on buttons
- [x] Fixed invisible text on select dropdowns
- [x] Fixed P&L table text visibility
- [x] Fixed Total Fees color visibility (orange-500)

### Spam Cleanup (Completed - 2026-02-07)
- [x] Marked 76+ transactions as spam (fake USDC, scam tokens)
- [x] P&L report now shows only 10 legitimate assets
- [x] Spam excluded: UЅDС, ꓴꓢꓓС, USDⅭ, openAI, GPT, BSX, Meow, SHIT, UNKNOWN, KIMO, DAS, MIM, KEKIUS, GUYS, DKP, BUSD, FUN, SENT, HORSE, NEXFI, AZTEC, DROID, EPSTEIN, FT

## Pending Tasks

### P0 - Critical
- None currently

### P1 - High Priority
1. **Full Interdependence (Double-Entry Accounting)**
   - Position ↔ Wallet: Auto-create deposit when "Rendement réalisé" added
   - Crypto → Position: Auto-decrease wallet when depositing to position
   - Crypto ↔ Crypto: Auto-create both send/receive transactions

### P2 - Medium Priority
2. **Fix gray rows in P&L table** - Assets with Unicode characters showing empty

### P3 - Low Priority / Backlog
3. **Refactoring**
   - Split `App.js` into separate page components
   - Split `server.py` into routes/models/services
   - Organize directory structure

## Database Schema

### Collections
- `users`: User accounts with hashed passwords
- `wallets`: Crypto wallet information
- `transactions`: Crypto transactions (with is_spam flag)
- `fiat_accounts`: Fiat account balances
- `fiat_transactions`: Fiat transaction records
- `positions`: DeFi/CeFi investment positions
- `position_movements`: Position earnings/withdrawals

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET/POST /api/fiat-transactions` - Fiat transactions
- `PUT/DELETE /api/fiat-transactions/{id}` - Edit/delete fiat tx
- `PUT /api/transactions/{id}` - Edit crypto transaction
- `GET/POST /api/positions` - Investment positions
- `POST /api/positions/{id}/movements` - Add position movement
- `GET /api/portfolio/pnl` - P&L report (excludes spam)
- `GET /api/export/fiscal-pdf` - PDF fiscal report

## Last Updated
2026-02-07 - Fixed Total Fees text color visibility in P&L page
