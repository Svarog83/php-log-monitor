/**
 * Crypto Tracker — Portfolio & FIFO Automation
 *
 * Adds a "Crypto Tracker" menu to the spreadsheet with:
 *   - Refresh All:            sync FIFO lots from new buys + rebuild Portfolio
 *   - Refresh Portfolio Only: rebuild Portfolio rows from current data
 *   - Sync FIFO Lots Only:    create FIFO lots from new Buy trades/fiat ops
 *
 * Workflow:
 *   1. Add your trades/fiat operations/transfers to the data sheets
 *   2. Click "Crypto Tracker → Refresh All"
 *   3. Portfolio and FIFO Lots update automatically
 *
 * Note: FIFO sell processing (reducing Qty Remaining on oldest lots)
 * is still manual for auditability. The script only creates lots from buys.
 *
 * @version 1.0.0
 * @author AI-assisted
 */

// ═══════════════════════════════════════════════════════
//  Menu
// ═══════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Crypto Tracker')
    .addItem('Refresh All', 'refreshAll')
    .addSeparator()
    .addItem('Refresh Portfolio Only', 'refreshPortfolio')
    .addItem('Sync FIFO Lots Only', 'syncFIFOLots')
    .addToUi();
}

// ═══════════════════════════════════════════════════════
//  Main entry point
// ═══════════════════════════════════════════════════════

function refreshAll() {
  const t0 = new Date();
  const lotsCreated = syncFIFOLots();
  const stats = refreshPortfolio();
  const elapsed = ((new Date() - t0) / 1000).toFixed(1);

  SpreadsheetApp.getUi().alert(
    'Refresh complete (' + elapsed + 's)\n\n' +
    'FIFO Lots: ' + lotsCreated + ' new lots created\n' +
    'Portfolio: ' + stats.total + ' rows (' + stats.added + ' new)'
  );
}

// ═══════════════════════════════════════════════════════
//  Portfolio — auto-generate rows for all asset/wallet combos
// ═══════════════════════════════════════════════════════

function refreshPortfolio() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var portfolio = ss.getSheetByName('Portfolio');

  // 1. Collect all asset/wallet combos from data sheets
  var combos = collectAssetWalletCombos_(ss);

  // 2. Read existing portfolio to preserve row order
  var data = portfolio.getDataRange().getValues();
  var ordered = [];
  var seen = {};

  for (var i = 1; i < data.length; i++) {
    var a = String(data[i][0] || '').trim();
    var w = String(data[i][1] || '').trim();
    if (a === 'TOTAL' || a === '') continue;
    var key = a + '|' + w;
    if (!seen[key]) {
      ordered.push({ asset: a, wallet: w });
      seen[key] = true;
    }
  }

  // 3. Add new combos (not yet in portfolio)
  var added = 0;
  for (var j = 0; j < combos.length; j++) {
    var key2 = combos[j].asset + '|' + combos[j].wallet;
    if (!seen[key2]) {
      ordered.push(combos[j]);
      seen[key2] = true;
      added++;
    }
  }

  var numRows = ordered.length;

  // 4. Clear everything below header
  var lastRow = Math.max(portfolio.getLastRow(), 2);
  if (lastRow > 1) {
    portfolio.getRange(2, 1, lastRow - 1, 13).clear();
  }

  // 5. Write all portfolio rows
  if (numRows > 0) {
    // Columns A-B: values
    var vals = [];
    for (var k = 0; k < numRows; k++) {
      vals.push([ordered[k].asset, ordered[k].wallet]);
    }
    portfolio.getRange(2, 1, numRows, 2).setValues(vals);

    // Columns C-M: formulas (11 columns)
    var fmls = [];
    for (var k2 = 0; k2 < numRows; k2++) {
      fmls.push(buildPortfolioFormulas_(k2 + 2));
    }
    portfolio.getRange(2, 3, numRows, 11).setFormulas(fmls);
  }

  // 6. TOTAL row (leave one empty row gap)
  var totalRow = numRows + 3;
  var endDataRow = numRows + 1;

  portfolio.getRange(totalRow, 1).setValue('TOTAL');
  portfolio.getRange(totalRow, 5).setFormula('=SUM(E2:E' + endDataRow + ')');
  portfolio.getRange(totalRow, 7).setFormula('=SUM(G2:G' + endDataRow + ')');
  portfolio.getRange(totalRow, 8).setFormula('=SUM(H2:H' + endDataRow + ')');
  portfolio.getRange(totalRow, 9).setFormula('=IF(E' + totalRow + '<>0,H' + totalRow + '/E' + totalRow + ',"")');
  portfolio.getRange(totalRow, 13).setFormula('=SUM(M2:M' + endDataRow + ')');

  // Style TOTAL row
  var totalRange = portfolio.getRange(totalRow, 1, 1, 13);
  totalRange.setFontWeight('bold');
  totalRange.setBorder(true, null, null, null, null, null,
    '#283593', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  return { total: numRows, added: added };
}

/**
 * Build the 11 formula strings for a single Portfolio row.
 * @param {number} r - 1-based sheet row number
 * @returns {string[]} Array of 11 formulas for columns C through M
 */
function buildPortfolioFormulas_(r) {
  return [
    // C: Balance (SUMIFS from all 3 data sheets)
    // FiatOperations: col O = Destination Wallet, col E = Crypto Asset, col F = Crypto Amount
    // Transfers: col G = Fee amount, col H = Fee Asset (Chain column inserted at N/F)
    '=SUMIFS(FiatOperations!F$2:F$1000,FiatOperations!O$2:O$1000,$B' + r +
      ',FiatOperations!E$2:E$1000,$A' + r + ',FiatOperations!B$2:B$1000,"Buy")' +
    '-SUMIFS(FiatOperations!F$2:F$1000,FiatOperations!O$2:O$1000,$B' + r +
      ',FiatOperations!E$2:E$1000,$A' + r + ',FiatOperations!B$2:B$1000,"Sell")' +
    '+SUMIFS(Trades!I$2:I$1000,Trades!B$2:B$1000,$B' + r +
      ',Trades!D$2:D$1000,$A' + r + ',Trades!G$2:G$1000,"Buy")' +
    '-SUMIFS(Trades!I$2:I$1000,Trades!B$2:B$1000,$B' + r +
      ',Trades!D$2:D$1000,$A' + r + ',Trades!G$2:G$1000,"Sell")' +
    '+SUMIFS(Trades!J$2:J$1000,Trades!B$2:B$1000,$B' + r +
      ',Trades!E$2:E$1000,$A' + r + ',Trades!G$2:G$1000,"Sell")' +
    '-SUMIFS(Trades!J$2:J$1000,Trades!B$2:B$1000,$B' + r +
      ',Trades!E$2:E$1000,$A' + r + ',Trades!G$2:G$1000,"Buy")' +
    '+SUMIFS(Transfers!C$2:C$1000,Transfers!E$2:E$1000,$B' + r +
      ',Transfers!B$2:B$1000,$A' + r + ')' +
    '-SUMIFS(Transfers!C$2:C$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!B$2:B$1000,$A' + r + ')' +
    '-SUMIFS(Transfers!G$2:G$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!H$2:H$1000,$A' + r + ')',

    // D: Avg Cost EUR (from FIFO lots)
    '=IFERROR(SUMIFS(FIFOLots!H$2:H$1000,FIFOLots!C$2:C$1000,$A' + r +
      ',FIFOLots!D$2:D$1000,$B' + r +
      ')/SUMIFS(FIFOLots!F$2:F$1000,FIFOLots!C$2:C$1000,$A' + r +
      ',FIFOLots!D$2:D$1000,$B' + r + '),"")',

    // E: Total Cost EUR
    '=IF(AND(C' + r + '<>"",D' + r + '<>""),C' + r + '*D' + r + ',"")',

    // F: Current Rate EUR (latest from Rates)
    '=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=$A' + r + '),1,FALSE),1,3),"")',

    // G: Current Value EUR
    '=IF(AND(C' + r + '<>"",F' + r + '<>""),C' + r + '*F' + r + ',"")',

    // H: Unrealized P/L EUR
    '=IF(AND(G' + r + '<>"",E' + r + '<>""),G' + r + '-E' + r + ',"")',

    // I: Unrealized P/L %
    '=IF(AND(E' + r + '<>"",E' + r + '<>0),H' + r + '/E' + r + ',"")',

    // J: Last Purchase Date
    '=IFERROR(TEXT(MAX(FILTER(FIFOLots!B$2:B$1000,FIFOLots!C$2:C$1000=$A' + r +
      ',FIFOLots!D$2:D$1000=$B' + r + ')),"YYYY-MM-DD"),"")',

    // K: Avg Holding Days (weighted by remaining qty)
    '=IFERROR(SUMPRODUCT((FIFOLots!C$2:C$1000=$A' + r +
      ')*(FIFOLots!D$2:D$1000=$B' + r +
      ')*FIFOLots!F$2:F$1000*FIFOLots!J$2:J$1000)' +
      '/SUMIFS(FIFOLots!F$2:F$1000,FIFOLots!C$2:C$1000,$A' + r +
      ',FIFOLots!D$2:D$1000,$B' + r + '),"")',

    // L: Qty Held >1 Year
    '=SUMPRODUCT((FIFOLots!C$2:C$1000=$A' + r +
      ')*(FIFOLots!D$2:D$1000=$B' + r +
      ')*(FIFOLots!J$2:J$1000>365)*FIFOLots!F$2:F$1000)',

    // M: Tax-Free Value EUR
    '=IF(AND(L' + r + '<>"",F' + r + '<>""),L' + r + '*F' + r + ',"")'
  ];
}

// ═══════════════════════════════════════════════════════
//  FIFO Lots — auto-create lots from new Buy operations
// ═══════════════════════════════════════════════════════

/**
 * Scan FiatOperations and Trades for Buy entries that don't yet
 * have a matching FIFO lot (matched by Source reference).
 * Creates new lot rows with auto-incrementing IDs.
 *
 * @returns {number} Number of new lots created
 */
function syncFIFOLots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lotsSheet = ss.getSheetByName('FIFOLots');
  var lotsData = lotsSheet.getDataRange().getValues();

  // Collect existing lot sources and find max ID
  var existingSources = {};
  var maxLotId = 0;
  for (var i = 1; i < lotsData.length; i++) {
    var src = String(lotsData[i][8] || '');
    if (src) existingSources[src] = true;
    var lotId = Number(lotsData[i][0]) || 0;
    if (lotId > maxLotId) maxLotId = lotId;
  }

  var nextLotId = maxLotId + 1;
  var newLots = [];

  // ── From FiatOperations (Buy = creates lot for crypto asset) ──
  var fiatData = ss.getSheetByName('FiatOperations').getDataRange().getValues();
  for (var fi = 1; fi < fiatData.length; fi++) {
    var fiatRef = 'Fiat #' + fi;
    if (existingSources[fiatRef]) continue;
    if (String(fiatData[fi][1]).trim() !== 'Buy') continue;

    var fCryptoAmt = Number(fiatData[fi][5]) || 0;
    if (fCryptoAmt === 0) continue;

    var fAmtEUR = Number(fiatData[fi][8]) || 0;

    newLots.push({
      lotId: nextLotId++,
      date: fiatData[fi][0],
      asset: String(fiatData[fi][4]),
      wallet: String(fiatData[fi][14] || ''),  // col O (Destination Wallet, index 14)
      qtyAcquired: fCryptoAmt,
      qtyRemaining: fCryptoAmt,
      costPerUnit: fAmtEUR > 0 ? fAmtEUR / fCryptoAmt : 0,
      source: fiatRef
    });
  }

  // ── From Trades (Buy direction = creates lot for base asset) ──
  var tradeData = ss.getSheetByName('Trades').getDataRange().getValues();
  for (var ti = 1; ti < tradeData.length; ti++) {
    var tradeRef = 'Trade #' + ti;
    if (existingSources[tradeRef]) continue;
    if (String(tradeData[ti][6]).trim() !== 'Buy') continue;

    var tFilledQty = Number(tradeData[ti][8]) || 0;
    if (tFilledQty === 0) continue;

    var tAmtEUR = Number(tradeData[ti][13]) || 0;

    newLots.push({
      lotId: nextLotId++,
      date: tradeData[ti][0],
      asset: String(tradeData[ti][3]),
      wallet: String(tradeData[ti][1] || ''),
      qtyAcquired: tFilledQty,
      qtyRemaining: tFilledQty,
      costPerUnit: tAmtEUR > 0 ? tAmtEUR / tFilledQty : 0,
      source: tradeRef
    });
  }

  if (newLots.length === 0) return 0;

  // ── Batch-write new lots ──
  var startRow = lotsData.length + 1;
  var n = newLots.length;

  // Columns A-G (values): Lot ID, Date, Asset, Wallet, Qty Acquired, Qty Remaining, Cost/Unit
  var valArr = [];
  for (var vi = 0; vi < n; vi++) {
    var lot = newLots[vi];
    valArr.push([
      lot.lotId, lot.date, lot.asset, lot.wallet,
      lot.qtyAcquired, lot.qtyRemaining, lot.costPerUnit
    ]);
  }
  lotsSheet.getRange(startRow, 1, n, 7).setValues(valArr);

  // Column I (value): Source
  var srcArr = [];
  for (var si = 0; si < n; si++) {
    srcArr.push([newLots[si].source]);
  }
  lotsSheet.getRange(startRow, 9, n, 1).setValues(srcArr);

  // Column H (formula): Total Cost EUR = F*G
  var fmlH = [];
  for (var hi = 0; hi < n; hi++) {
    var rh = startRow + hi;
    fmlH.push(['=F' + rh + '*G' + rh]);
  }
  lotsSheet.getRange(startRow, 8, n, 1).setFormulas(fmlH);

  // Columns J-K (formulas): Days Held, Tax-Free?
  var fmlJK = [];
  for (var ji = 0; ji < n; ji++) {
    var rj = startRow + ji;
    fmlJK.push([
      '=IF(B' + rj + '<>"",TODAY()-B' + rj + ',"")',
      '=IF(J' + rj + '>365,"Yes","No")'
    ]);
  }
  lotsSheet.getRange(startRow, 10, n, 2).setFormulas(fmlJK);

  return n;
}

// ═══════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════

/**
 * Scan all data sheets and collect unique (asset, wallet) pairs.
 */
function collectAssetWalletCombos_(ss) {
  var combos = {};
  var result = [];

  function add(asset, wallet) {
    asset = String(asset || '').trim();
    wallet = String(wallet || '').trim();
    if (!asset || !wallet) return;
    var key = asset + '|' + wallet;
    if (!combos[key]) {
      combos[key] = true;
      result.push({ asset: asset, wallet: wallet });
    }
  }

  // FiatOperations: col E (Crypto Asset) + col O (Destination Wallet, index 14)
  var fiatData = ss.getSheetByName('FiatOperations').getDataRange().getValues();
  for (var i = 1; i < fiatData.length; i++) {
    add(fiatData[i][4], fiatData[i][14]);
  }

  // Trades: base + quote asset at exchange
  var tradeData = ss.getSheetByName('Trades').getDataRange().getValues();
  for (var j = 1; j < tradeData.length; j++) {
    add(tradeData[j][3], tradeData[j][1]); // base asset @ exchange
    add(tradeData[j][4], tradeData[j][1]); // quote asset @ exchange
  }

  // Transfers: asset at both from/to wallet
  var transferData = ss.getSheetByName('Transfers').getDataRange().getValues();
  for (var k = 1; k < transferData.length; k++) {
    add(transferData[k][1], transferData[k][3]); // asset @ from-wallet
    add(transferData[k][1], transferData[k][4]); // asset @ to-wallet
  }

  return result;
}
