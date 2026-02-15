# Crypto Tracker - Implementation Plan

## Overview

Google Spreadsheet with 7 sheets to track crypto investments, trades, transfers, and portfolio balance.
FIFO lot tracking for German 1-year tax-free holding rule. Auto-calculated balances via SUMIFS formulas.

## Architecture

```
Reference Sheets          Data Entry Sheets           Calculated Sheets
┌──────────┐              ┌────────────────┐          ┌───────────┐
│ Wallets  │──dropdowns──>│ FiatOperations │──SUMIFS──>│ Portfolio │
│ Rates    │──VLOOKUP────>│ Trades         │──SUMIFS──>│           │
│          │              │ Transfers      │──SUMIFS──>│           │
└──────────┘              └────────────────┘          │           │
                          ┌────────────────┐          │           │
                          │ FIFOLots       │──────────>│           │
                          └────────────────┘          └───────────┘
```

## Sheet Definitions

### 1. Portfolio (first tab, summary)
Columns: Asset, Wallet, Balance, Avg Cost EUR, Total Cost EUR, Current Rate EUR, Current Value EUR,
Unrealized P/L EUR, Unrealized P/L %, Last Purchase Date, Avg Holding Days, Qty Held >1 Year, Tax-Free Value EUR

### 2. FiatOperations
Columns: Date, Type, Fiat Currency, Fiat Amount, Crypto Asset, Crypto Amount, Price Per Unit,
EUR Rate, Fiat Amount EUR, Fee, Fee Currency, Fee EUR, Source Platform, Chain, Destination Wallet, Notes

### 3. Trades
Columns: Date, Exchange, Pair, Base Asset, Quote Asset, Type, Direction, Filled Price, Filled Quantity,
Order Amount, Fee, Fee Asset, EUR Rate, Amount EUR, Fee EUR, Status, Notes

### 4. Transfers
Columns: Date, Asset, Amount, From Wallet, To Wallet, Chain, Fee, Fee Asset, EUR Rate, Fee EUR, TX Hash, Notes

### 5. FIFOLots
Columns: Lot ID, Date Acquired, Asset, Wallet, Qty Acquired, Qty Remaining, Cost Per Unit EUR,
Total Cost EUR, Source, Days Held, Tax-Free?

### 6. Rates
Columns: Date, Asset, EUR Rate

### 7. Wallets
Columns: Wallet ID, Full Name, Type, Notes

## Key Design Decisions

- **FIFO over weighted average**: Required for German Spekulationsfrist tracking
- **Rates sheet with closest-date lookup**: FILTER+SORT finds most recent rate <= transaction date
- **Semi-manual FIFO lots**: Avoids complex array formulas, keeps it auditable
- **Trades match exchange export format**: Easy copy-paste from Bybit/other exchange exports
- **Separate FiatOperations and Transfers**: Avoids double-counting; fiat purchase creates crypto at source location, transfer moves it
- **Portfolio uses SUMIFS**: Auto-updates when data is added, no manual recalculation needed
