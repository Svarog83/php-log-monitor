# Crypto Tracker - Data Flow & Workflow

## Typical Investment Workflow

```
Step 1: Buy USDT for RUB via P2P
  └─> FiatOperations: Date, Buy, RUB, 100000, USDT, 1050, ..., Chain, P2P
  └─> Rates: 2026-02-01, RUB, 0.0094

Step 2: Transfer USDT from P2P to Bybit exchange
  └─> Transfers: Date, USDT, 1050, P2P, Bybit, 0, USDT

Step 3: Trade USDT for BTC on Bybit
  └─> Trades: Date, Bybit, BTC_USDT, ..., Limit, Buy, 69000, 0.00290, ...
  └─> FIFOLots: new lot for BTC, 0.00290, cost = 69000*0.96 EUR/unit

Step 4: (Optional) Withdraw BTC to Ledger
  └─> Transfers: Date, BTC, 0.00290, Bybit, Ledger, 0.00001, BTC
  └─> FIFOLots: update wallet from Bybit to Ledger

Portfolio auto-updates after each step:
  - USDT/P2P: +1050 (step 1), -1050 (step 2) = 0
  - USDT/Bybit: +1050 (step 2), -200 (step 3) = 850
  - BTC/Bybit: +0.00290 (step 3), -0.00290 (step 4) = 0
  - BTC/Ledger: +0.00290 (step 4) - 0.00001 (fee) = 0.00289
```

## Data Integrity Rules

1. **No double-counting**: FiatOps destination wallet is where crypto FIRST appears.
   If bought via P2P, destination = P2P, then a separate Transfer moves it to exchange.

2. **FIFO lot consistency**: Sum of all FIFOLots Qty Remaining for an asset/wallet
   should match the Portfolio Balance for that asset/wallet.

3. **Rate availability**: Every transaction date + asset combination must have a
   rate in the Rates sheet (on that date or earlier). Missing rates = empty EUR values.

4. **Wallet names must match exactly**: "Bybit" in Trades must be exactly "Bybit"
   in Wallets, Transfers, and Portfolio. Case-sensitive.

## Selling Crypto (FIFO Process)

When selling crypto (e.g., selling 0.001 BTC):

1. Add the sell trade in **Trades** (Direction = "Sell")
2. Go to **FIFOLots**, find the OLDEST lots for that asset/wallet
3. Reduce "Qty Remaining" (column F) on the oldest lot first
4. If the oldest lot is fully consumed (Qty Remaining = 0), move to the next oldest
5. Continue until the sold quantity is fully accounted for

Example: Selling 0.005 BTC, having lots:
- Lot 7: 0.00289855 remaining -> reduce to 0, consumed fully
- Lot 9: 0.00294117 remaining -> reduce to 0.00083972 (0.005 - 0.00289855 = 0.00210145 from this lot)

The "Tax-Free?" column automatically reflects whether each lot's holding period exceeds 365 days.
