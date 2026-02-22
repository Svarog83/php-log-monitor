# Crypto Investment Tracker

Google Spreadsheet for tracking cryptocurrency investments, trades, transfers, and portfolio balance.
FIFO lot tracking for German Spekulationsfrist (1-year tax-free holding rule).

## Spreadsheet

- **URL**: https://docs.google.com/spreadsheets/d/1egHbo6p0J0UPjFrqwz89OslRVR11lLlxSJEx8RiH2EM/edit
- **Spreadsheet ID**: `1egHbo6p0J0UPjFrqwz89OslRVR11lLlxSJEx8RiH2EM`
- **MCP Server**: `google-sheets-python` (full API including formatting via batch_update)

## Sheet Structure (8 tabs)

| # | Sheet | Purpose |
|---|-------|---------|
| 1 | **Portfolio** | Auto-calculated summary: balance per asset/wallet, avg cost, P&L, holding period, tax-free qty |
| 2 | **FiatOperations** | Fiat↔crypto transactions: buying crypto for fiat, spending crypto via card |
| 3 | **Trades** | Crypto↔crypto exchanges on exchanges (Buy and Sell directions) |
| 4 | **Transfers** | Movement of crypto between wallets/exchanges (with chain tracking) |
| 5 | **FIFOLots** | FIFO lot tracking with automated sell processing |
| 6 | **Rates** | EUR exchange rates — auto-updated via CoinGecko API |
| 7 | **Wallets** | Wallet/exchange reference list with types (Exchange, Hardware, Software, Custodial) |
| 8 | **ChainBalances** | Breakdown by Asset/Wallet/Chain for self-custody; total balance for exchanges |

## Data Flow

```
Wallets (reference) ──> Wallet type detection (Exchange vs Wallet)
Rates (reference)   ──> EUR rates in all sheets (auto-updated via CoinGecko)

FiatOperations ─┐
Trades         ─┼──> Portfolio (SUMIFS balance aggregation)
Transfers      ─┘

FiatOperations (Buy) ─┐
Trades (Buy)         ─┼──> FIFOLots (lot creation, automated)
Trades (Sell)        ─┘    └──> FIFOLots (lot for received quote asset)

FiatOperations (Sell) ─┐
Trades (Sell)         ─┼──> FIFOLots (Qty Remaining reduction, FIFO order)
                       │
FIFOLots ──────────────┼──> Portfolio (avg cost, holding days, tax-free qty)
                       │
FiatOperations ─┐      │
Transfers      ─┼──────┼──> ChainBalances (chain breakdown for wallets)
Trades         ─┘      └──> ChainBalances (total balance for exchanges)
```

## How to Use

### Apps Script Setup (one-time)
1. Open the spreadsheet
2. Extensions → Apps Script
3. Paste the contents of `apps-script.gs` (from this docs folder)
4. Click Save, then close the Apps Script editor
5. Reload the spreadsheet — "Crypto Tracker" menu appears
6. First run: click any menu item, authorize when prompted
7. Run **Crypto Tracker → Set CoinGecko API Key...** and set your Demo API key via the script editor:
   ```
   setCoinGeckoApiKey('CG-yourKeyHere')
   ```

### Quick Start
1. Add your data to FiatOperations / Trades / Transfers
2. Click **Crypto Tracker → Refresh All** in the menu bar
3. Everything auto-updates: rates, FIFO lots, sell processing, Portfolio, ChainBalances

### Adding a Fiat Purchase (e.g., buying USDT for RUB via P2P)
1. Add a row in **FiatOperations**: Date, Buy, RUB, amount, USDT, qty, ...
   - Set Chain and Destination Wallet
2. Click **Refresh All** → creates FIFO lot + updates Portfolio

### Adding a Crypto Trade (e.g., buying ETH with USDT on MEXC)
1. Add a row in **Trades**: Date, MEXC, ETH_USDT, ..., Buy, price, qty
2. Click **Refresh All** → creates FIFO lot for ETH + updates Portfolio

### Selling Crypto (e.g., selling ETH for USDC on MEXC)
1. Add a row in **Trades**: Date, MEXC, ETH_USDC, ..., **Sell**, price, qty
   - The base asset (ETH) is what you sell, quote asset (USDC) is what you receive
2. Click **Refresh All** →
   - ETH FIFO lots are reduced (oldest first, FIFO)
   - New USDC FIFO lot is created (with cost basis = EUR value of the trade)
   - Portfolio recalculates balances and avg cost

### Spending Crypto via Card (e.g., USDC on Coca card)
1. Add a row in **FiatOperations**: Date, **Sell**, EUR, fiat_amount, USDC, crypto_amount
   - Destination Wallet = card wallet (e.g., Coca)
2. Click **Refresh All** → USDC FIFO lots are reduced, Portfolio updates

### Adding a Transfer (e.g., moving ETH from MEXC to Ledger)
1. Add a row in **Transfers**: Date, ETH, amount, MEXC, Ledger, chain, fee, fee_asset
2. Click **Refresh All** → adds new wallet combos to Portfolio + ChainBalances

### Updating Rates
- Rates auto-update via CoinGecko when you click **Refresh All** or **Update Crypto Rates**
- Configured assets: BTC, ETH, SOL, USDT, USDC (by coin ID), COCA (by Polygon contract)
- Manual entry is still needed for fiat rates (RUB/EUR)

## Automation (Apps Script)

### Menu Items

| Menu Item | What it does |
|-----------|-------------|
| **Refresh All** | Updates rates → creates FIFO lots → processes FIFO sells → rebuilds Portfolio → rebuilds ChainBalances |
| **Update Crypto Rates** | Fetches BTC, ETH, SOL, USDT, USDC, COCA prices from CoinGecko, writes to Rates sheet |
| **Refresh Portfolio Only** | Scans all data sheets, adds/rebuilds Portfolio rows for all asset/wallet combos |
| **Refresh Chain Balances Only** | Rebuilds ChainBalances sheet (chain breakdown for wallets, totals for exchanges) |
| **Sync FIFO Lots Only** | Creates lot entries for new Buy/Sell trades and fiat ops |
| **Set CoinGecko API Key...** | Stores API key in Script Properties (one-time setup) |

### What is Fully Automated
- FIFO lot creation from Buy entries (Trades + FiatOperations)
- FIFO lot creation for received quote asset on Sell trades
- FIFO sell processing: automatic Qty Remaining reduction (oldest lots first)
- Portfolio row generation for all asset/wallet combinations
- All Portfolio formulas (balance, avg cost, P/L, holding days, tax-free qty)
- ChainBalances with chain breakdown (wallets) vs total balance (exchanges)
- EUR rate updates from CoinGecko API (BTC, ETH, SOL, USDT, USDC, COCA)

### What is Still Manual
- Fiat currency rates (RUB/EUR) in the Rates sheet
- Data entry in FiatOperations, Trades, Transfers
- FIFO lot wallet tracking: lots stay at purchase wallet (transfer tracking not yet implemented)

## Wallets

| Wallet ID | Type | Notes |
|-----------|------|-------|
| MEXC | Exchange | RU driving license |
| KuCoin | Exchange | RU Passport |
| Ledger | Hardware | Cold storage |
| HOT | Software | Telegram / Chrome extension |
| Coca | Custodial | EU crypto card |
| Wirex | Custodial | EU crypto card, German tax number |

## Known Limitations

1. **FIFO lots don't follow transfers**: Lots stay at purchase wallet; avg cost uses global (per-asset) aggregation to compensate
2. **Fiat rates are manual**: Only crypto rates auto-update via CoinGecko
3. **CoinGecko rate limits**: Demo API key allows 30 req/min, 10K/month (we use 2 calls per refresh)
