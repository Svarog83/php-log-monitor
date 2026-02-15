# Crypto Investment Tracker

Google Spreadsheet for tracking cryptocurrency investments, trades, transfers, and portfolio balance.

## Spreadsheet

- **URL**: https://docs.google.com/spreadsheets/d/1egHbo6p0J0UPjFrqwz89OslRVR11lLlxSJEx8RiH2EM/edit
- **Spreadsheet ID**: `1egHbo6p0J0UPjFrqwz89OslRVR11lLlxSJEx8RiH2EM`
- **MCP Server**: `google-sheets-python` (full API including formatting via batch_update)

## Sheet Structure (7 tabs)

| # | Sheet | Purpose |
|---|-------|---------|
| 1 | **Portfolio** | Auto-calculated summary: balance per asset/wallet, P&L, holding period, tax-free qty |
| 2 | **FiatOperations** | Fiat-to-crypto and crypto-to-fiat transactions (deposits/withdrawals) |
| 3 | **Trades** | Crypto-to-crypto exchanges on exchanges (matches Bybit export format) |
| 4 | **Transfers** | Movement of crypto between wallets/exchanges |
| 5 | **FIFOLots** | FIFO lot tracking for German Spekulationsfrist (1-year tax-free rule) |
| 6 | **Rates** | EUR exchange rates reference (manually updated) |
| 7 | **Wallets** | Wallet/exchange reference list |

## Data Flow

```
Wallets (reference) ──> Dropdowns in FiatOps, Trades, Transfers
Rates (reference)   ──> VLOOKUP EUR rates in FiatOps, Trades, Transfers, Portfolio

FiatOperations ─┐
Trades         ─┼──> Portfolio (SUMIFS balance aggregation)
Transfers      ─┘

FiatOperations ─┐
Trades         ─┼──> FIFOLots (lot creation, semi-manual)
                │
FIFOLots       ──> Portfolio (avg cost, holding days, tax-free qty)
```

## How to Use

### Quick Start (with Apps Script)
1. Add your data to FiatOperations / Trades / Transfers
2. Make sure Rates has EUR rates for the relevant dates
3. Click **Crypto Tracker → Refresh All** in the menu bar
4. Portfolio rows and FIFO lots are created/updated automatically

### Apps Script Setup (one-time)
1. Open the spreadsheet
2. Extensions → Apps Script
3. Paste the contents of `apps-script.gs` (from this docs folder)
4. Click Save, then close the Apps Script editor
5. Reload the spreadsheet — "Crypto Tracker" menu appears in the menu bar
6. First run: click any menu item, authorize when prompted

### Adding a Fiat Purchase (e.g., buying USDT for RUB via P2P)
1. Add a rate entry in **Rates** (date, RUB, EUR rate) if not already present
2. Add a row in **FiatOperations** (date, Buy, RUB, amount, USDT, qty, etc.)
   - Columns G (Price/Unit), H (EUR Rate), I (Fiat EUR), L (Fee EUR) auto-calculate
3. Add a row in **Transfers** if you move the crypto to another wallet
4. Click **Crypto Tracker → Refresh All** (creates FIFO lot + updates Portfolio)

### Adding a Crypto Trade (e.g., buying BTC with USDT on Bybit)
1. Ensure the **Rates** sheet has a USDT EUR rate for that date
2. Add a row in **Trades** -- fill Date, Exchange, Pair, Type, Direction, Filled Price, Filled Qty
   - Columns D (Base Asset), E (Quote Asset), J (Order Amount), M (EUR Rate), N (Amount EUR) auto-calculate
3. Click **Crypto Tracker → Refresh All** (creates FIFO lot + updates Portfolio)

### Adding a Transfer (e.g., moving BTC from Bybit to Ledger)
1. Add a row in **Transfers** (date, asset, amount, from wallet, to wallet, fee)
2. Click **Crypto Tracker → Refresh All** (adds new wallet combos to Portfolio)

### Selling Crypto (FIFO)
1. Add the sell trade in **Trades** (Direction = "Sell")
2. Click **Crypto Tracker → Refresh All** (Portfolio balance updates automatically)
3. Manually go to **FIFOLots** and reduce "Qty Remaining" on the oldest lots (FIFO order)

### Updating Rates
1. Add new rows in **Rates** with Date, Asset, EUR Rate
2. Keep sorted by date (ascending) for best lookup performance
3. The system uses the most recent rate on or before the transaction date

## Formula Reference

### EUR Rate Lookup (used in FiatOps, Trades, Transfers)
```
=IFERROR(INDEX(SORT(FILTER(Rates!A:C, Rates!B:B=<asset_cell>, Rates!A:A<=<date_cell>), 1, FALSE), 1, 3), "")
```
Finds the most recent rate for the given asset on or before the given date.

### Portfolio Balance (column C)
Aggregates from all 3 data sheets:
- FiatOperations: +bought / -sold crypto at this wallet
- Trades: +bought base / -sold base + sold quote / -bought quote at this exchange
- Transfers: +incoming / -outgoing / -fees at this wallet

### FIFO Tax-Free Detection (FIFOLots column K)
```
=IF(TODAY()-B2 > 365, "Yes", "No")
```
German Spekulationsfrist: crypto held > 1 year is tax-free on disposal.

## Automation (Apps Script)

The script `apps-script.gs` provides three functions via the "Crypto Tracker" menu:

| Function | What it does |
|----------|-------------|
| **Refresh All** | Runs both FIFO sync + Portfolio rebuild |
| **Sync FIFO Lots Only** | Creates lot entries for new Buy trades/fiat ops (matched by Source ref) |
| **Refresh Portfolio Only** | Scans all data sheets, adds Portfolio rows for new asset/wallet combos, rebuilds all formulas |

**What is automated:**
- FIFO lot creation from new Buy entries (Trades + FiatOperations)
- Portfolio row generation for all asset/wallet combinations
- All Portfolio formulas (balance, P/L, holding days, tax-free qty)

**What is still manual:**
- FIFO sell processing: when selling, reduce Qty Remaining on oldest lots in FIFO order
- EUR rate updates in the Rates sheet
- Transfer of lot wallet when you move crypto between wallets

## Dropdowns (Data Validation)

All dropdowns are pre-configured:

- **FiatOperations**: Type (Buy/Sell), Fiat Currency, Crypto Asset, Fee Currency, Destination Wallet
- **Trades**: Exchange, Type (Limit/Market), Direction (Buy/Sell), Fee Asset, Status
- **Transfers**: Asset, From/To Wallet, Fee Asset
- **FIFOLots**: Asset, Wallet
- **Wallets**: Type (Exchange/Hardware/Software/Custodial)

Wallet dropdowns pull from the Wallets sheet dynamically. Asset dropdowns allow typing custom values.

## Known Limitations

1. **No automated price feeds**: EUR rates must be manually updated in Rates sheet
2. **FIFO sell processing is manual**: User reduces Qty Remaining on oldest lots when selling
3. **Lot wallet tracking**: When transferring crypto, lot wallet must be manually updated

## Future Improvements

- Automated FIFO sell processing in Apps Script
- API integration for live crypto/fiat EUR rates (CoinGecko, ECB)
- Conditional formatting for P/L (green/red), tax-free status highlighting
- Charts/dashboards for portfolio allocation and performance
- Import/export scripts for exchange trade history
