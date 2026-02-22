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
    .addItem('Update Crypto Rates', 'updateCryptoRates')
    .addItem('Refresh Portfolio Only', 'refreshPortfolio')
    .addItem('Refresh Chain Balances Only', 'refreshChainBalances')
    .addItem('Sync FIFO Lots Only', 'syncFIFOLots')
    .addSeparator()
    .addItem('Set CoinGecko API Key...', 'setCoinGeckoApiKey')
    .addToUi();
}

// ═══════════════════════════════════════════════════════
//  Main entry point
// ═══════════════════════════════════════════════════════

function refreshAll() {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lotsCreated = syncFIFOLots();
  var sellsProcessed = processFIFOSells_(ss);
  var stats = refreshPortfolio();
  var chainStats = refreshChainBalances();
  var elapsed = ((new Date() - t0) / 1000).toFixed(1);

  SpreadsheetApp.getUi().alert(
    'Refresh complete (' + elapsed + 's)\n\n' +
    'FIFO Lots: ' + lotsCreated + ' new lots, ' + sellsProcessed + ' sells processed\n' +
    'Portfolio: ' + stats.total + ' rows (' + stats.added + ' new)\n' +
    'Chain Balances: ' + chainStats.total + ' rows (' + chainStats.added + ' new)'
  );
}

// ═══════════════════════════════════════════════════════
//  Crypto Rates — CoinGecko Demo API
// ═══════════════════════════════════════════════════════

var CRYPTO_RATE_CONFIG_ = {
  baseUrl: 'https://api.coingecko.com/api/v3',
  // Standard coins: asset symbol → CoinGecko ID
  coins: {
    'BTC':  'bitcoin',
    'ETH':  'ethereum',
    'SOL':  'solana',
    'USDT': 'tether',
    'USDC': 'usd-coin'
  },
  // Tokens not listed by coin ID — use contract address
  contracts: {
    'COCA': { platform: 'polygon-pos', address: '0x7B12598E3616261df1C05EC28De0d2fB10c1F206' }
  },
  vsCurrency: 'eur'
};

/**
 * One-time setup: store your CoinGecko Demo API key in Script Properties.
 * Run this once from the Apps Script editor, then the key persists securely.
 *
 * Usage: setCoinGeckoApiKey('CG-yourKeyHere')
 */
function setCoinGeckoApiKey(key) {
  if (!key) {
    SpreadsheetApp.getUi().alert(
      'Usage: run setCoinGeckoApiKey("CG-yourKeyHere") from the script editor.\n\n' +
      'Get a free Demo key at https://www.coingecko.com/en/api/pricing');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('COINGECKO_API_KEY', key);
  SpreadsheetApp.getUi().alert('CoinGecko API key saved successfully.');
}

/** @returns {string} API key from Script Properties */
function getCoinGeckoApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('COINGECKO_API_KEY') || '';
}

/**
 * Build fetch options with the CoinGecko Demo API key header.
 * @returns {Object} options for UrlFetchApp.fetch
 */
function cgFetchOptions_() {
  var key = getCoinGeckoApiKey_();
  var opts = { muteHttpExceptions: true };
  if (key) {
    opts.headers = { 'x-cg-demo-api-key': key };
  }
  return opts;
}

/**
 * Fetch current EUR rates for configured crypto assets from CoinGecko
 * and upsert them into the Rates sheet with today's date.
 *
 * API key is read from Script Properties (set via setCoinGeckoApiKey).
 * Demo tier: 30 req/min, 10 000/month — our 2 calls per run are well within limits.
 *
 * @returns {{ updated: number, errors: string[] }}
 */
function updateCryptoRates() {
  var cfg = CRYPTO_RATE_CONFIG_;
  var rates = {};
  var errors = [];
  var opts = cgFetchOptions_();

  if (!getCoinGeckoApiKey_()) {
    errors.push('No API key — run setCoinGeckoApiKey("CG-...") first');
  }

  // ── Step 1: Standard coins (BTC, ETH, SOL) — single batch call ──
  var ids = [];
  var idToAsset = {};
  for (var asset in cfg.coins) {
    ids.push(cfg.coins[asset]);
    idToAsset[cfg.coins[asset]] = asset;
  }

  if (ids.length > 0) {
    try {
      var url1 = cfg.baseUrl + '/simple/price?ids=' + ids.join(',') +
                 '&vs_currencies=' + cfg.vsCurrency;
      var resp1 = UrlFetchApp.fetch(url1, opts);
      if (resp1.getResponseCode() === 200) {
        var data1 = JSON.parse(resp1.getContentText());
        for (var cgId in data1) {
          if (data1[cgId][cfg.vsCurrency] !== undefined) {
            rates[idToAsset[cgId]] = data1[cgId][cfg.vsCurrency];
          }
        }
      } else {
        errors.push('CoinGecko /simple/price: HTTP ' + resp1.getResponseCode());
      }
    } catch (e) {
      errors.push('CoinGecko /simple/price: ' + e.message);
    }
  }

  // ── Step 2: Contract-based tokens (COCA) — one call per token ──
  for (var tokenAsset in cfg.contracts) {
    var tk = cfg.contracts[tokenAsset];
    try {
      var url2 = cfg.baseUrl + '/simple/token_price/' + tk.platform +
                 '?contract_addresses=' + tk.address +
                 '&vs_currencies=' + cfg.vsCurrency;
      var resp2 = UrlFetchApp.fetch(url2, opts);
      if (resp2.getResponseCode() === 200) {
        var data2 = JSON.parse(resp2.getContentText());
        var addrKey = tk.address.toLowerCase();
        if (data2[addrKey] && data2[addrKey][cfg.vsCurrency] !== undefined) {
          rates[tokenAsset] = data2[addrKey][cfg.vsCurrency];
        }
      } else {
        errors.push('CoinGecko token ' + tokenAsset + ': HTTP ' + resp2.getResponseCode());
      }
    } catch (e) {
      errors.push('CoinGecko token ' + tokenAsset + ': ' + e.message);
    }
  }

  // ── Step 3: Write rates to Rates sheet ──
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Rates');
  if (!sheet) {
    errors.push('Rates sheet not found');
    return { updated: 0, errors: errors };
  }

  var today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var existing = sheet.getDataRange().getValues();
  var updated = 0;

  for (var rateAsset in rates) {
    var eurRate = rates[rateAsset];
    var found = false;

    for (var ri = 1; ri < existing.length; ri++) {
      var rowDate = existing[ri][0];
      if (rowDate instanceof Date) {
        rowDate = Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      }
      if (String(rowDate) === today && String(existing[ri][1]).trim() === rateAsset) {
        sheet.getRange(ri + 1, 3).setValue(eurRate);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([today, rateAsset, eurRate]);
    }
    updated++;
  }

  return { updated: updated, errors: errors };
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
    // FiatOperations: col O = Dest Wallet (14), col N = Chain (13), col E = Crypto Asset, col F = Crypto Amount
    // Transfers: col F = Fee (5), col G = Fee Asset (6), col K = Chain (10)
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
    '-SUMIFS(Transfers!F$2:F$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!G$2:G$1000,$A' + r + ')',

    // D: Avg Cost EUR (weighted average across all FIFO lots for this asset)
    '=IFERROR(SUMIFS(FIFOLots!H$2:H$1000,FIFOLots!C$2:C$1000,$A' + r +
      ')/SUMIFS(FIFOLots!F$2:F$1000,FIFOLots!C$2:C$1000,$A' + r + '),"")',

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

  // ── From Trades (Buy direction = creates lot for RECEIVED base asset) ──
  var tradeData = ss.getSheetByName('Trades').getDataRange().getValues();
  for (var ti = 1; ti < tradeData.length; ti++) {
    var direction = String(tradeData[ti][6]).trim();

    if (direction === 'Buy') {
      var buyRef = 'Trade #' + ti;
      if (existingSources[buyRef]) continue;

      var tFilledQty = Number(tradeData[ti][8]) || 0;
      if (tFilledQty === 0) continue;
      var tAmtEUR = Number(tradeData[ti][13]) || 0;

      newLots.push({
        lotId: nextLotId++,
        date: tradeData[ti][0],
        asset: String(tradeData[ti][3]),        // Base asset (received)
        wallet: String(tradeData[ti][1] || ''),
        qtyAcquired: tFilledQty,
        qtyRemaining: tFilledQty,
        costPerUnit: tAmtEUR > 0 ? tAmtEUR / tFilledQty : 0,
        source: buyRef
      });
    }

    // ── Sell direction = creates lot for RECEIVED quote asset ──
    // When you sell ETH for USDC, the received USDC needs a cost lot.
    // Cost basis = EUR value of the trade (same as the sold asset's EUR value).
    if (direction === 'Sell') {
      var sellRef = 'Trade #' + ti + ' (quote)';
      if (existingSources[sellRef]) continue;

      var tOrderAmt = Number(tradeData[ti][9]) || 0;  // Order Amount = quote received
      if (tOrderAmt === 0) continue;
      var tSellAmtEUR = Number(tradeData[ti][13]) || 0;

      newLots.push({
        lotId: nextLotId++,
        date: tradeData[ti][0],
        asset: String(tradeData[ti][4]),        // Quote asset (received)
        wallet: String(tradeData[ti][1] || ''),
        qtyAcquired: tOrderAmt,
        qtyRemaining: tOrderAmt,
        costPerUnit: tSellAmtEUR > 0 ? tSellAmtEUR / tOrderAmt : 0,
        source: sellRef
      });
    }
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
//  FIFO Sell Processing — reduce Qty Remaining on sells
// ═══════════════════════════════════════════════════════

/**
 * Process all sell/disposal operations against FIFO lots.
 * Idempotent: resets Qty Remaining to Qty Acquired, then processes
 * all disposals chronologically using FIFO order (oldest lots first).
 *
 * Disposals processed:
 *   - Trades with Direction = "Sell" → disposes base asset
 *   - FiatOperations with Type = "Sell" → disposes crypto asset
 *
 * FIFO is applied globally per asset (not per wallet), consistent
 * with the predominant interpretation for German crypto tax.
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 * @returns {number} Number of disposals processed
 */
function processFIFOSells_(ss) {
  var lotsSheet = ss.getSheetByName('FIFOLots');
  var lotsData = lotsSheet.getDataRange().getValues();

  // 1. Build lot objects, reset Qty Remaining → Qty Acquired
  var lots = [];
  for (var i = 1; i < lotsData.length; i++) {
    lots.push({
      row: i + 1,
      date: lotsData[i][1],
      asset: String(lotsData[i][2] || '').trim(),
      qtyAcquired: Number(lotsData[i][4]) || 0,
      qtyRemaining: Number(lotsData[i][4]) || 0
    });
  }

  // 2. Collect all disposals
  var disposals = [];

  // Trades: Direction = "Sell" → disposes the base asset
  var tradeData = ss.getSheetByName('Trades').getDataRange().getValues();
  for (var ti = 1; ti < tradeData.length; ti++) {
    if (String(tradeData[ti][6]).trim() !== 'Sell') continue;
    var tQty = Number(tradeData[ti][8]) || 0;
    if (tQty <= 0) continue;
    disposals.push({
      date: tradeData[ti][0],
      asset: String(tradeData[ti][3]).trim(),
      qty: tQty
    });
  }

  // FiatOperations: Type = "Sell" → disposes crypto asset
  var fiatData = ss.getSheetByName('FiatOperations').getDataRange().getValues();
  for (var fi = 1; fi < fiatData.length; fi++) {
    if (String(fiatData[fi][1]).trim() !== 'Sell') continue;
    var fQty = Number(fiatData[fi][5]) || 0;
    if (fQty <= 0) continue;
    disposals.push({
      date: fiatData[fi][0],
      asset: String(fiatData[fi][4]).trim(),
      qty: fQty
    });
  }

  if (disposals.length === 0) return 0;

  // 3. Sort disposals by date
  disposals.sort(function(a, b) {
    var da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    var db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return da - db;
  });

  // 4. Process each disposal (FIFO: oldest lots first)
  for (var s = 0; s < disposals.length; s++) {
    var d = disposals[s];
    var remaining = d.qty;

    // Gather lots for this asset, sorted by acquisition date ASC
    var assetLots = [];
    for (var li = 0; li < lots.length; li++) {
      if (lots[li].asset === d.asset) assetLots.push(lots[li]);
    }
    assetLots.sort(function(a, b) {
      var da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      var db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return da - db;
    });

    for (var ai = 0; ai < assetLots.length && remaining > 1e-10; ai++) {
      var lot = assetLots[ai];
      if (lot.qtyRemaining <= 1e-10) continue;
      var consume = Math.min(lot.qtyRemaining, remaining);
      lot.qtyRemaining -= consume;
      remaining -= consume;
    }
  }

  // 5. Write updated Qty Remaining (column F)
  if (lots.length > 0) {
    var updates = [];
    for (var u = 0; u < lots.length; u++) {
      updates.push([lots[u].qtyRemaining < 1e-10 ? 0 : lots[u].qtyRemaining]);
    }
    lotsSheet.getRange(2, 6, updates.length, 1).setValues(updates);
  }

  return disposals.length;
}

// ═══════════════════════════════════════════════════════
//  Chain Balances — breakdown by Asset/Wallet/Chain
// ═══════════════════════════════════════════════════════

/**
 * Auto-generate rows on ChainBalances sheet.
 *
 * Two modes based on wallet type (from Wallets sheet):
 * - Exchange wallets: one row per asset, Chain = "All", full Portfolio formula (incl. Trades)
 * - Non-exchange wallets: rows per (asset, wallet, chain), chain-specific formula
 *
 * @returns {{ total: number, added: number }}
 */
function refreshChainBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ChainBalances');
  if (!sheet) return { total: 0, added: 0 };

  // 1. Get exchange wallet names from Wallets sheet
  var exchanges = getExchangeWallets_(ss);

  // 2. Collect combos: chain-specific for wallets, "All" for exchanges
  var walletCombos = collectAssetWalletChainCombos_(ss);
  var exchangeCombos = collectAssetWalletCombos_(ss);

  // 3. Read existing to preserve order
  var data = sheet.getDataRange().getValues();
  var ordered = [];
  var seen = {};

  for (var i = 1; i < data.length; i++) {
    var a = String(data[i][0] || '').trim();
    var w = String(data[i][1] || '').trim();
    var c = String(data[i][2] || '').trim();
    if (a === '' || a === 'TOTAL') continue;
    var key = a + '|' + w + '|' + c;
    if (!seen[key]) {
      ordered.push({ asset: a, wallet: w, chain: c, isExchange: exchanges[w] || false });
      seen[key] = true;
    }
  }

  // 4. Add new wallet combos (non-exchange only)
  var added = 0;
  for (var j = 0; j < walletCombos.length; j++) {
    if (exchanges[walletCombos[j].wallet]) continue; // skip exchanges
    var key2 = walletCombos[j].asset + '|' + walletCombos[j].wallet + '|' + walletCombos[j].chain;
    if (!seen[key2]) {
      ordered.push({ asset: walletCombos[j].asset, wallet: walletCombos[j].wallet,
                      chain: walletCombos[j].chain, isExchange: false });
      seen[key2] = true;
      added++;
    }
  }

  // 5. Add exchange combos (chain = "All")
  for (var e = 0; e < exchangeCombos.length; e++) {
    if (!exchanges[exchangeCombos[e].wallet]) continue; // only exchanges
    var key3 = exchangeCombos[e].asset + '|' + exchangeCombos[e].wallet + '|All';
    if (!seen[key3]) {
      ordered.push({ asset: exchangeCombos[e].asset, wallet: exchangeCombos[e].wallet,
                      chain: 'All', isExchange: true });
      seen[key3] = true;
      added++;
    }
  }

  var numRows = ordered.length;

  // 6. Clear below header
  var lastRow = Math.max(sheet.getLastRow(), 2);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 6).clear();
  }

  // 7. Write rows
  if (numRows > 0) {
    var vals = [];
    for (var k = 0; k < numRows; k++) {
      vals.push([ordered[k].asset, ordered[k].wallet, ordered[k].chain]);
    }
    sheet.getRange(2, 1, numRows, 3).setValues(vals);

    var fmls = [];
    for (var k2 = 0; k2 < numRows; k2++) {
      var r = k2 + 2;
      if (ordered[k2].isExchange) {
        fmls.push(buildExchangeBalanceFormulas_(r));
      } else {
        fmls.push(buildChainBalanceFormulas_(r));
      }
    }
    sheet.getRange(2, 4, numRows, 3).setFormulas(fmls);
  }

  return { total: numRows, added: added };
}

/**
 * Build the 3 formula strings for a single ChainBalances row.
 * @param {number} r - 1-based sheet row number
 * @returns {string[]} Array of 3 formulas for columns D (Balance), E (EUR Rate), F (Value EUR)
 */
function buildChainBalanceFormulas_(r) {
  return [
    // D: Balance by chain (FiatOps + Transfers only, no Trades)
    // FiatOps: col O = Dest Wallet, col N = Chain, col E = Asset, col F = Amount
    // Transfers: col K = Chain, col F = Fee, col G = Fee Asset
    '=SUMIFS(FiatOperations!F$2:F$1000,FiatOperations!O$2:O$1000,$B' + r +
      ',FiatOperations!E$2:E$1000,$A' + r +
      ',FiatOperations!N$2:N$1000,$C' + r +
      ',FiatOperations!B$2:B$1000,"Buy")' +
    '-SUMIFS(FiatOperations!F$2:F$1000,FiatOperations!O$2:O$1000,$B' + r +
      ',FiatOperations!E$2:E$1000,$A' + r +
      ',FiatOperations!N$2:N$1000,$C' + r +
      ',FiatOperations!B$2:B$1000,"Sell")' +
    '+SUMIFS(Transfers!C$2:C$1000,Transfers!E$2:E$1000,$B' + r +
      ',Transfers!B$2:B$1000,$A' + r +
      ',Transfers!K$2:K$1000,$C' + r + ')' +
    '-SUMIFS(Transfers!C$2:C$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!B$2:B$1000,$A' + r +
      ',Transfers!K$2:K$1000,$C' + r + ')' +
    '-SUMIFS(Transfers!F$2:F$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!G$2:G$1000,$A' + r +
      ',Transfers!K$2:K$1000,$C' + r + ')',

    // E: Current EUR Rate
    '=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=$A' + r + '),1,FALSE),1,3),"")',

    // F: Value EUR
    '=IF(AND(D' + r + '<>"",E' + r + '<>""),D' + r + '*E' + r + ',"")'
  ];
}

/**
 * Build the 3 formula strings for an exchange row on ChainBalances.
 * Uses the full Portfolio formula (includes Trades), no chain filter.
 * @param {number} r - 1-based sheet row number
 * @returns {string[]} Array of 3 formulas for columns D, E, F
 */
function buildExchangeBalanceFormulas_(r) {
  return [
    // D: Full balance (same as Portfolio — FiatOps + Trades + Transfers, no chain filter)
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
    '-SUMIFS(Transfers!F$2:F$1000,Transfers!D$2:D$1000,$B' + r +
      ',Transfers!G$2:G$1000,$A' + r + ')',

    // E: Current EUR Rate
    '=IFERROR(INDEX(SORT(FILTER(Rates!A:C,Rates!B:B=$A' + r + '),1,FALSE),1,3),"")',

    // F: Value EUR
    '=IF(AND(D' + r + '<>"",E' + r + '<>""),D' + r + '*E' + r + ',"")'
  ];
}

/**
 * Read Wallets sheet and return a map of exchange wallet IDs.
 * @returns {Object} Map like { "MEXC": true, "KuCoin": true }
 */
function getExchangeWallets_(ss) {
  var map = {};
  var walletsSheet = ss.getSheetByName('Wallets');
  if (!walletsSheet) return map;
  var data = walletsSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var walletId = String(data[i][0] || '').trim();
    var walletType = String(data[i][2] || '').trim();
    if (walletType === 'Exchange') {
      map[walletId] = true;
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════

/**
 * Scan FiatOperations and Transfers for unique (asset, wallet, chain) triples.
 * Trades are excluded (no chain info on exchanges).
 */
function collectAssetWalletChainCombos_(ss) {
  var combos = {};
  var result = [];

  function add(asset, wallet, chain) {
    asset = String(asset || '').trim();
    wallet = String(wallet || '').trim();
    chain = String(chain || '').trim();
    if (!asset || !wallet || !chain) return;
    var key = asset + '|' + wallet + '|' + chain;
    if (!combos[key]) {
      combos[key] = true;
      result.push({ asset: asset, wallet: wallet, chain: chain });
    }
  }

  // FiatOperations: col E = Asset (4), col O = Dest Wallet (14), col N = Chain (13)
  var fiatData = ss.getSheetByName('FiatOperations').getDataRange().getValues();
  for (var i = 1; i < fiatData.length; i++) {
    add(fiatData[i][4], fiatData[i][14], fiatData[i][13]);
  }

  // Transfers: col B = Asset (1), col D/E = From/To Wallet (3/4), col K = Chain (10)
  var transferData = ss.getSheetByName('Transfers').getDataRange().getValues();
  for (var k = 1; k < transferData.length; k++) {
    add(transferData[k][1], transferData[k][4], transferData[k][10]); // asset @ to-wallet @ chain
    add(transferData[k][1], transferData[k][3], transferData[k][10]); // asset @ from-wallet @ chain
  }

  return result;
}

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
