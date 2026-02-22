# Crypto Tracker - Architecture & Design Decisions

## Overview

Google Spreadsheet with 8 sheets + Google Apps Script automation to track crypto investments,
trades, transfers, and portfolio balance. FIFO lot tracking for German 1-year Spekulationsfrist.

## Architecture

```
Reference Sheets          Data Entry Sheets           Calculated Sheets
┌──────────┐              ┌────────────────┐          ┌───────────────┐
│ Wallets  │──dropdowns──>│ FiatOperations │──SUMIFS──>│ Portfolio     │
│ Rates    │──VLOOKUP────>│ Trades         │──SUMIFS──>│               │
│          │              │ Transfers      │──SUMIFS──>│               │
└──────────┘              └────────────────┘          └───────────────┘
     │                           │                           ▲
     │                           ▼                           │
     │                    ┌────────────────┐                 │
     │                    │ FIFOLots       │─── Avg Cost ───>│
     │                    │ (auto FIFO)    │                 │
     │                    └────────────────┘                 │
     │                                                       │
     └──── Type detection ──> ┌────────────────┐            │
                              │ ChainBalances  │<───────────┘
                              │ (chain/wallet) │
                              └────────────────┘

External API:
  CoinGecko ──> Rates (auto-update BTC, ETH, SOL, USDT, USDC, COCA)
```

## Sheet Definitions

### 1. Portfolio (summary, all formulas auto-generated)
Columns: Asset, Wallet, Balance, Avg Cost EUR, Total Cost EUR, Current Rate EUR,
Current Value EUR, Unrealized P/L EUR, Unrealized P/L %, Last Purchase Date,
Avg Holding Days, Qty Held >1 Year, Tax-Free Value EUR

### 2. FiatOperations (manual entry)
Columns: Date, Type (Buy/Sell), Fiat Currency, Fiat Amount, Crypto Asset, Crypto Amount,
Price Per Unit, EUR Rate, Fiat Amount EUR, Fee, Fee Currency, Fee EUR,
Source Platform, Chain, Destination Wallet, Notes

- **Buy**: Purchasing crypto with fiat
- **Sell**: Spending crypto (e.g., card purchases), reduces FIFO lots

### 3. Trades (manual entry, matches exchange export format)
Columns: Date, Exchange, Pair, Base Asset, Quote Asset, Type, Direction,
Filled Price, Filled Quantity, Order Amount, Fee, Fee Asset, EUR Rate,
Amount EUR, Fee EUR, Status, Notes

- **Buy**: You receive the Base Asset, spend the Quote Asset
- **Sell**: You sell the Base Asset, receive the Quote Asset
- Sell trades create FIFO lots for the received Quote Asset

### 4. Transfers (manual entry)
Columns: Date, Asset, Amount, From Wallet, To Wallet, Chain, Fee, Fee Asset,
EUR Rate, Fee EUR, TX Hash, Notes

### 5. FIFOLots (auto-generated + auto-processed)
Columns: Lot ID, Date Acquired, Asset, Wallet, Qty Acquired, Qty Remaining,
Cost Per Unit EUR, Total Cost EUR, Source, Days Held, Tax-Free?

- Lots created by `syncFIFOLots()` from Buy trades and Buy fiat ops
- Sell trades also create lots for the received quote asset
- `processFIFOSells_()` reduces Qty Remaining automatically in FIFO order

### 6. Rates (auto-updated + manual for fiat)
Columns: Date, Asset, EUR Rate

- Crypto rates auto-fetched from CoinGecko: BTC, ETH, SOL, USDT, USDC, COCA
- Fiat rates (RUB) added manually

### 7. Wallets (reference)
Columns: Wallet ID, Full Name, Type, Notes

- Type field determines behavior in ChainBalances: "Exchange" vs other

### 8. ChainBalances (auto-generated)
Columns: Asset, Wallet, Chain, Balance, Current Rate EUR, Value EUR

- Self-custody wallets: chain-by-chain breakdown (from Transfers chain info)
- Exchanges: "All" chain, total balance (no chain breakdown)

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **FIFO over weighted average** | Required for German Spekulationsfrist tracking (1-year holding rule) |
| **Rates sheet with closest-date lookup** | FILTER+SORT finds most recent rate ≤ transaction date |
| **Automated FIFO processing** | `syncFIFOLots()` + `processFIFOSells_()` ensure lot consistency |
| **Sell trade creates quote lot** | When selling ETH for USDC, the received USDC gets a FIFO lot with cost basis = EUR value of the trade |
| **Global avg cost (ignoring wallet)** | Lots stay at purchase wallet; avg cost aggregates across all wallets for an asset to handle transfers |
| **Exchange vs wallet chain logic** | Exchanges don't track chain (balance = total across all chains); wallets show chain breakdown |
| **CoinGecko API with stored key** | Demo API key stored in Script Properties; supports standard coins + contract tokens |
| **Idempotent FIFO processing** | `processFIFOSells_()` resets all quantities before reprocessing; safe to run multiple times |
| **Trades match exchange format** | Easy copy-paste from MEXC/Bybit/KuCoin exports |
| **No double-counting** | FiatOps dest wallet = where crypto first appears; Transfer moves it |
