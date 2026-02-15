# Crypto Tracker - Progress

## Status: v1.0 Complete (2026-02-14)

## What's Done

### Spreadsheet Structure
- [x] 7 sheet tabs created: Portfolio, FiatOperations, Trades, Transfers, FIFOLots, Rates, Wallets
- [x] All headers set for all sheets
- [x] Auto-calculated formulas in all sheets

### Reference Sheets
- [x] Wallets: 5 sample entries (Bybit, Binance, Ledger, MetaMask, P2P)
- [x] Rates: Initial EUR rates for BTC, ETH, SOL, XLM, COCA, USDT, RUB (Feb 2026 dates)

### Data Entry Sheets
- [x] FiatOperations: Headers + formula template (row 2 has working sample)
  - Auto-calculates: Price Per Unit, EUR Rate (VLOOKUP), Fiat Amount EUR, Fee EUR
- [x] Trades: Headers + 10 sample trades from user's Bybit export
  - Auto-calculates: Base/Quote Asset (from Pair), Order Amount, EUR Rate (VLOOKUP), Amount EUR, Fee EUR
- [x] Transfers: Headers + formula template (row 2 has working sample)
  - Auto-calculates: EUR Rate (VLOOKUP), Fee EUR

### Calculated Sheets
- [x] FIFOLots: Headers + 10 lots matching sample trades
  - Auto-calculates: Total Cost EUR, Days Held, Tax-Free flag
- [x] Portfolio: 6 asset/wallet rows + TOTAL row
  - Auto-calculates: Balance (SUMIFS from all data sheets), Avg Cost EUR, Total Cost EUR,
    Current Rate/Value EUR, Unrealized P/L (EUR and %), Last Purchase Date,
    Avg Holding Days, Qty >1 Year, Tax-Free Value EUR

### Documentation
- [x] README.md with full usage guide
- [x] plan.md with architecture and design decisions
- [x] progress.md (this file)
- [x] formulas.md with all formula references

## What's Left / Future Work

- [ ] Manual data validation (dropdowns) in Google Sheets UI -- MCP can't set this
- [ ] Conditional formatting (P/L colors, tax-free highlighting)
- [ ] Charts/dashboards
- [ ] Google Apps Script for auto-populating FIFO lots from Trades
- [ ] API integration for live EUR rates (CoinGecko, ECB)
- [ ] Auto-generate Portfolio rows from UNIQUE(assets+wallets)
- [ ] Import/export scripts for exchange trade history

## Known Issues

- USDT balance on Bybit shows negative (-258) because sample data has more trades spending
  USDT than was deposited via FiatOps+Transfers. This is correct behavior -- it indicates
  more fiat deposit records need to be added to match actual trading history.
- Avg Holding Days for USDT row is not calculated (USDT is not tracked as FIFO lots)
