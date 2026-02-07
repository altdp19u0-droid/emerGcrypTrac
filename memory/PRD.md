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
- **URL**: https://reports-backend.preview.emergentagent.com
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
- None - Full interdependence implemented

### P2 - Medium Priority
- Manual testing of all 3 interdependence types via UI

### P3 - Low Priority / Backlog
1. **Refactoring**
   - Split `App.js` into separate page components
   - Split `server.py` into routes/models/services
   - Organize directory structure

## Completed Features

### Interdependence System (2026-02-07)
- [x] Crypto ↔ Crypto: Auto-create counterpart transaction for internal transfers
- [x] Position ↔ Wallet: Auto-create withdrawal when depositing to position
- [x] Movement → Wallet: Auto-create deposit for realized yield/capital withdrawal

### Auto-Assignment Rules (2026-02-07)
- [x] Position rules configuration (address + asset matching)
- [x] Preview matching transactions before applying
- [x] Auto-create movements (capital_deposit, yield_realized) from matching transactions
- [x] Link transactions to positions (linked_position_id)

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
