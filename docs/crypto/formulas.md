# Crypto Tracker - Formula Reference

All formulas use ranges $2:$1000 to avoid full-column references for performance.

## EUR Rate Lookup (shared pattern)

Used in FiatOperations (H), Trades (M), Transfers (H), Portfolio (F).

```
=IFERROR(INDEX(SORT(FILTER(Rates!A:C, Rates!B:B=<asset>, Rates!A:A<=<date>), 1, FALSE), 1, 3), "")
```

Logic:
1. FILTER: Get all Rates rows where asset matches AND date <= transaction date
2. SORT by date descending (column 1, FALSE)
3. INDEX row 1, column 3: Take the EUR rate from the most recent matching row

## FiatOperations Formulas

| Column | Name | Formula (row 2 example) |
|--------|------|------------------------|
| G | Price Per Unit | `=IF(F2>0, D2/F2, "")` |
| H | EUR Rate | `=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=C2,Rates!A:A<=A2),1,FALSE),1,3),"")` |
| I | Fiat Amount EUR | `=IF(AND(D2<>"",H2<>""), D2*H2, "")` |
| L | Fee EUR | `=IF(AND(J2<>"",H2<>""), J2*H2, "")` |

## Trades Formulas

| Column | Name | Formula (row 2 example) |
|--------|------|------------------------|
| D | Base Asset | `=LEFT(C2, FIND("_",C2)-1)` |
| E | Quote Asset | `=MID(C2, FIND("_",C2)+1, LEN(C2))` |
| J | Order Amount | `=H2*I2` |
| M | EUR Rate | `=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=E2,Rates!A:A<=A2),1,FALSE),1,3),"")` |
| N | Amount EUR | `=IF(AND(J2<>"",M2<>""), J2*M2, "")` |
| O | Fee EUR | `=IF(AND(K2<>"",M2<>""), K2*M2, "")` |

Note: EUR Rate looks up the **quote asset** rate (e.g., USDT for BTC_USDT pair).

## Transfers Formulas

| Column | Name | Formula (row 2 example) |
|--------|------|------------------------|
| H | EUR Rate | `=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=B2,Rates!A:A<=A2),1,FALSE),1,3),"")` |
| I | Fee EUR | `=IF(AND(F2<>"",H2<>""), F2*H2, "")` |

## FIFOLots Formulas

| Column | Name | Formula (row 2 example) |
|--------|------|------------------------|
| H | Total Cost EUR | `=F2*G2` |
| J | Days Held | `=IF(B2<>"", TODAY()-B2, "")` |
| K | Tax-Free? | `=IF(J2>365, "Yes", "No")` |

## Portfolio Formulas

### Balance (Column C) - Most Complex Formula

```
= SUMIFS(FiatOps bought at wallet)
- SUMIFS(FiatOps sold at wallet)
+ SUMIFS(Trades bought base asset at exchange)
- SUMIFS(Trades sold base asset at exchange)
+ SUMIFS(Trades sold quote = this asset at exchange)
- SUMIFS(Trades bought quote = this asset at exchange)
+ SUMIFS(Transfers incoming to wallet)
- SUMIFS(Transfers outgoing from wallet)
- SUMIFS(Transfer fees from wallet for this asset)
```

Full formula (row 2, A2=Asset, B2=Wallet):
```
=SUMIFS(FiatOperations!F$2:F$1000, FiatOperations!O$2:O$1000,$B2, FiatOperations!E$2:E$1000,$A2, FiatOperations!B$2:B$1000,"Buy")
-SUMIFS(FiatOperations!F$2:F$1000, FiatOperations!O$2:O$1000,$B2, FiatOperations!E$2:E$1000,$A2, FiatOperations!B$2:B$1000,"Sell")
+SUMIFS(Trades!I$2:I$1000, Trades!B$2:B$1000,$B2, Trades!D$2:D$1000,$A2, Trades!G$2:G$1000,"Buy")
-SUMIFS(Trades!I$2:I$1000, Trades!B$2:B$1000,$B2, Trades!D$2:D$1000,$A2, Trades!G$2:G$1000,"Sell")
+SUMIFS(Trades!J$2:J$1000, Trades!B$2:B$1000,$B2, Trades!E$2:E$1000,$A2, Trades!G$2:G$1000,"Sell")
-SUMIFS(Trades!J$2:J$1000, Trades!B$2:B$1000,$B2, Trades!E$2:E$1000,$A2, Trades!G$2:G$1000,"Buy")
+SUMIFS(Transfers!C$2:C$1000, Transfers!E$2:E$1000,$B2, Transfers!B$2:B$1000,$A2)
-SUMIFS(Transfers!C$2:C$1000, Transfers!D$2:D$1000,$B2, Transfers!B$2:B$1000,$A2)
-SUMIFS(Transfers!G$2:G$1000, Transfers!D$2:D$1000,$B2, Transfers!H$2:H$1000,$A2)
```

**Note:** FiatOperations col O = Destination Wallet (col N = Chain).
Transfers col G = Fee amount, col H = Fee Asset (col F = Chain).

### Other Portfolio Columns

| Column | Name | Formula |
|--------|------|---------|
| D | Avg Cost EUR | `=IFERROR(SUMIFS(FIFOLots total cost) / SUMIFS(FIFOLots remaining qty), "")` |
| E | Total Cost EUR | `=C2*D2` |
| F | Current Rate EUR | `=IFERROR(INDEX(SORT(FILTER(Rates!A:C, Rates!B:B=$A2), 1, FALSE), 1, 3), "")` |
| G | Current Value EUR | `=C2*F2` |
| H | Unrealized P/L EUR | `=G2-E2` |
| I | Unrealized P/L % | `=H2/E2` |
| J | Last Purchase Date | `=IFERROR(TEXT(MAX(FILTER(FIFOLots dates for asset+wallet)), "YYYY-MM-DD"), "")` |
| K | Avg Holding Days | `=IFERROR(SUMPRODUCT(remaining_qty * days_held) / SUM(remaining_qty), "")` |
| L | Qty >1 Year | `=SUMPRODUCT(remaining_qty * (days>365))` |
| M | Tax-Free Value EUR | `=L2*F2` |

## Adding Formulas to New Rows

When adding a new row to any data sheet, copy formulas from the row above. Key auto-calculated columns:

- **FiatOperations**: G, H, I, L (copy from row 2)
- **Trades**: D, E, J, M, N, O (copy from row 2)
- **Transfers**: H, I (copy from row 2)
- **FIFOLots**: H, J, K (copy from row 2)
- **Portfolio**: C through M (copy from any existing row)

All formulas use `$` on column references and row ranges ($2:$1000) so they work correctly when copied between rows.
