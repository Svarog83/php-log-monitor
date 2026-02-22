# Crypto Tracker - Progress

## Status: v2.1 Complete (2026-02-22)

## What's Done

### v1.0 (2026-02-14) — Base Structure
- [x] 7 sheet tabs: Portfolio, FiatOperations, Trades, Transfers, FIFOLots, Rates, Wallets
- [x] All headers and auto-calculated formulas
- [x] Wallets: 6 entries (MEXC, KuCoin, Ledger, HOT, Coca, Wirex)
- [x] Rates: Initial EUR rates for BTC, ETH, SOL, XLM, COCA, USDT, RUB
- [x] FiatOperations: Buy/Sell types with auto-calc columns (Price/Unit, EUR Rate, Amount EUR, Fee EUR)
- [x] Trades: 10+ sample trades from exchange exports
- [x] Transfers: With chain tracking
- [x] FIFOLots: Lot creation from Buy trades
- [x] Portfolio: SUMIFS balance aggregation from all data sheets
- [x] Data validation dropdowns on all sheets
- [x] Apps Script: menu, refreshPortfolio, syncFIFOLots

### v2.0 (2026-02-15) — Full Automation
- [x] **ChainBalances sheet** (8th tab): chain-by-chain breakdown for wallets, total balance for exchanges
- [x] **Exchange detection**: Wallets sheet Type="Exchange" → no chain breakdown in ChainBalances
- [x] **CoinGecko API integration**: Auto-fetch EUR rates for BTC, ETH, SOL, USDT, USDC, COCA
- [x] **Secure API key storage**: CoinGecko Demo key stored via PropertiesService
- [x] **COCA rate via contract address**: Polygon contract `0xe44Fd7fCb2b1581822D0c862B68222998a0c299a`
- [x] **FiatOperations visual improvements**: Sell rows highlighted, summary block (total Buy/Sell/Diff EUR)
- [x] **FIFO sell processing (automated)**: `processFIFOSells_()` reduces Qty Remaining in FIFO order
- [x] **Sell quote lot creation**: Sell trades in Trades auto-create FIFO lots for received quote asset
- [x] **Global avg cost**: Portfolio Avg Cost EUR aggregates across all wallets (handles transfers)
- [x] **FiatOperations sells in FIFO**: Card spending (Sell in FiatOps) reduces lots automatically
- [x] **Idempotent sell processing**: Safe to run multiple times; resets before reprocessing
- [x] **Refresh All pipeline**: updateCryptoRates → syncFIFOLots → processFIFOSells → refreshPortfolio → refreshChainBalances

### v2.1 (2026-02-22) — Summary Dashboard
- [x] **Summary sheet** (9th tab): formula-based dashboard with 9 data sections and 8 embedded charts
- [x] **KPI cards**: Portfolio Value, Fiat Invested, Net P/L, P/L %, Fees, Avg Hold Days, Tax-Free Value, Losses
- [x] **Allocation by Asset**: QUERY-based dynamic pivot + pie chart
- [x] **Allocation by Storage Type**: Exchange(Hot)/Hardware(Cold)/Software/Custodial + pie chart
- [x] **Allocation by Risk Level**: Low/Medium/High/Critical + pie chart
- [x] **Allocation by Wallet**: QUERY-based dynamic pivot + horizontal bar chart
- [x] **Cost vs Value per Asset**: Grouped column chart (cost basis vs market value)
- [x] **Investment Overview**: Fiat invested vs current portfolio + column chart
- [x] **Stablecoin vs Volatile**: Portfolio risk exposure split + pie chart
- [x] **Trade Statistics**: Total trades, volume, avg size, by exchange, buy/sell ratio, trading period
- [x] **Holding & Tax Analysis**: Weighted avg holding days per asset + bar chart (365-day tax threshold)
- [x] **Auto-update**: All formula-based — updates automatically when Portfolio/Trades/FiatOperations change (no script)

### Documentation
- [x] README.md — full usage guide with workflows for all transaction types
- [x] plan.md — architecture, sheet definitions, design decisions
- [x] progress.md — this file
- [x] formulas.md — complete formula reference (including Summary section)
- [x] data-flow.md — investment workflow examples and data integrity rules

## What's Left / Future Work

- [ ] FIFO lot wallet tracking on transfers (lots stay at purchase wallet currently)
- [x] Charts/dashboards for portfolio allocation and performance (Summary sheet, v2.1)
- [ ] Conditional formatting for P/L (green/red), tax-free status highlighting
- [ ] Import/export scripts for exchange trade history (CSV import)
- [ ] ECB API integration for fiat rates (RUB/EUR)
- [ ] Realized P/L tracking (sell price minus cost basis)
- [ ] Annual tax report generation (gains from lots held <1 year)
- [ ] Portfolio value history tracking (snapshot over time)

## Known Issues

- FIFO lots stay at purchase wallet — if you buy ETH on MEXC and transfer to Ledger,
  the lot's wallet is still "MEXC". Avg Cost uses global aggregation to compensate.
- CoinGecko Demo API: 30 req/min, 10K/month limit. Current usage: 2 calls per refresh.
- Stablecoin rates (USDT, USDC) are fetched but typically ≈ 1 EUR ± small fluctuation.
