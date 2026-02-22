# Crypto Tracker - Data Flow & Workflow

## Transaction Types & Recording

### 1. Buy Crypto for Fiat (e.g., buy USDT for RUB via P2P)

```
FiatOperations: Date | Buy | RUB | 100000 | USDT | 1050 | ... | Chain | Wallet
  → Auto: Price/Unit, EUR Rate, Amount EUR, Fee EUR
  → Refresh All: creates FIFO lot (Source: "FiatOp #N")
  → Portfolio: +1050 USDT at Wallet
```

### 2. Trade Crypto for Crypto — Buy Direction (e.g., buy ETH with USDT on MEXC)

```
Trades: Date | MEXC | ETH_USDT | ... | Buy | 2351.00 | 0.04259 | ...
  → Auto: Base=ETH, Quote=USDT, Order Amount, EUR Rate, Amount EUR
  → Refresh All: creates FIFO lot for ETH (Source: "Trade #N")
  → Portfolio: +0.04259 ETH, -100.13 USDT at MEXC
```

### 3. Trade Crypto for Crypto — Sell Direction (e.g., sell ETH, receive USDC on MEXC)

```
Trades: Date | MEXC | ETH_USDC | ... | Sell | 2600.00 | 0.1 | ...
  → Auto: Base=ETH, Quote=USDC, Order Amount=260, EUR Rate, Amount EUR
  → Refresh All:
    - ETH FIFO lots reduced by 0.1 (oldest first, FIFO order)
    - New USDC FIFO lot created: 260 USDC, cost = Amount EUR / 260 per unit
    - Source: "Trade #N (quote)"
  → Portfolio: -0.1 ETH, +260 USDC at MEXC
```

### 4. Spend Crypto via Card (e.g., pay with USDC on Coca card)

```
FiatOperations: Date | Sell | EUR | 50.00 | USDC | 52.5 | ... | Coca
  → Refresh All: USDC FIFO lots reduced by 52.5 (oldest first)
  → Portfolio: -52.5 USDC at Coca
```

### 5. Transfer Between Wallets (e.g., ETH from MEXC to Ledger)

```
Transfers: Date | ETH | 0.5 | MEXC | Ledger | Ethereum | 0.001 | ETH
  → Portfolio: -0.5 ETH at MEXC, +0.5 ETH at Ledger, -0.001 ETH fee at MEXC
  → ChainBalances: +0.5 ETH on Ethereum chain at Ledger
```

## Full Investment Lifecycle Example

```
Step 1: Buy USDT for RUB via P2P
  └─> FiatOperations: Buy, RUB, 100000, USDT, 1050, P2P wallet
  └─> Rates: 2026-02-01, RUB, 0.0094
  └─> FIFO: Lot created — 1050 USDT @ 0.895 EUR/unit

Step 2: Transfer USDT from P2P to MEXC
  └─> Transfers: USDT, 1050, P2P, MEXC, TRC20, fee 1, USDT

Step 3: Buy ETH with USDT on MEXC
  └─> Trades: MEXC, ETH_USDT, Buy, 2351.00, 0.04259
  └─> FIFO: Lot created — 0.04259 ETH @ EUR cost

Step 4: Sell part of ETH for USDC on MEXC
  └─> Trades: MEXC, ETH_USDC, Sell, 2600.00, 0.01
  └─> FIFO: ETH lots reduced by 0.01 (FIFO), USDC lot created for 26 USDC

Step 5: Transfer remaining ETH to Ledger
  └─> Transfers: ETH, 0.03259, MEXC, Ledger, Ethereum, 0.001, ETH

Step 6: Spend USDC via Coca card at a shop (50 EUR purchase)
  └─> FiatOperations: Sell, EUR, 50, USDC, 52.5, Coca wallet
  └─> FIFO: USDC lots reduced by 52.5

Portfolio after all steps:
  - USDT/MEXC:   ~950 (1050 - 100.13 trade - 1 transfer fee)
  - ETH/MEXC:    0 (all transferred out)
  - ETH/Ledger:  0.03159 (0.03259 - 0.001 fee)
  - USDC/MEXC:   26 - 52.5 = negative (need more USDC deposits to match)
  
ChainBalances:
  - ETH / Ledger / Ethereum: 0.03159
  - USDT / MEXC / All: ~950 (exchange — no chain breakdown)
```

## FIFO Sell Processing (processFIFOSells_)

The sell processing is fully automated and idempotent:

1. **Reset**: All lots' Qty Remaining is reset to Qty Acquired
2. **Collect disposals**: Gathers all sell events from:
   - Trades where Direction = "Sell" (base asset is sold)
   - FiatOperations where Type = "Sell" (crypto spent for fiat)
3. **Sort by date**: All disposals processed chronologically
4. **FIFO reduction**: For each disposal, find matching asset lots (sorted by acquisition date), reduce oldest first
5. **Write back**: Updated Qty Remaining values written to FIFOLots column F

This ensures consistent state regardless of the order transactions were entered.

## Data Integrity Rules

1. **No double-counting**: FiatOps destination wallet is where crypto FIRST appears.
   If bought via P2P, destination = P2P, then a separate Transfer moves it to exchange.

2. **FIFO lot consistency**: Sum of FIFOLots Qty Remaining for an asset should approximate
   the total Portfolio Balance across all wallets for that asset.

3. **Rate availability**: Every transaction date + asset combination must have a
   rate in the Rates sheet (on that date or earlier). Missing rates = empty EUR values.
   Crypto rates (BTC, ETH, SOL, USDT, USDC, COCA) auto-update from CoinGecko.

4. **Wallet names must match exactly**: "MEXC" in Trades must be exactly "MEXC"
   in Wallets, Transfers, and Portfolio. Case-sensitive.

5. **Sell trade = two events**: Selling ETH for USDC creates two things:
   - Disposal of ETH (FIFO reduction)
   - Acquisition of USDC (new FIFO lot with cost basis)

6. **Avg cost is global per asset**: Since lots don't follow transfers between wallets,
   Portfolio avg cost aggregates all FIFO lots for an asset regardless of wallet.
