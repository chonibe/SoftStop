#!/usr/bin/env node
/**
 * RTP Verification Script
 * Runs a Monte Carlo simulation of 10 million spins to verify
 * the slot machine's theoretical RTP matches the 96% target.
 *
 * Usage: node scripts/calculate-rtp.js [numSpins]
 */

// Inline the reel strips and pay table since this runs in Node without webpack

// Reel 1: cherry(17) lemon(14) orange(10) grape(7) bell(5) bar(3) lucky7(2) diamond(1) wild(4) scatter(1) = 64
// Reel 2: cherry(17) lemon(14) orange(10) grape(7) bell(6) bar(3) lucky7(2) diamond(1) wild(3) scatter(1) = 64
// Reel 3: cherry(18) lemon(14) orange(10) grape(7) bell(5) bar(3) lucky7(2) diamond(1) wild(3) scatter(1) = 64
// Reel 4: cherry(17) lemon(14) orange(10) grape(7) bell(6) bar(3) lucky7(2) diamond(1) wild(3) scatter(1) = 64
// Reel 5: cherry(18) lemon(14) orange(10) grape(7) bell(5) bar(3) lucky7(2) diamond(1) wild(3) scatter(1) = 64
const REEL_1 = [
  "cherry","lemon","orange","grape","bell","cherry","lemon","orange",
  "grape","bar","cherry","lemon","orange","grape","bell","cherry",
  "lemon","orange","bell","lucky7","cherry","lemon","grape","wild",
  "cherry","lemon","orange","grape","bar","cherry","lemon","cherry",
  "lemon","orange","bell","cherry","lemon","cherry","lemon","orange",
  "grape","wild","bar","cherry","lemon","orange","cherry","lemon",
  "wild","cherry","lucky7","cherry","lemon","grape","diamond","cherry",
  "lemon","orange","grape","orange","wild","cherry","scatter","orange"
];
const REEL_2 = [
  "lemon","cherry","orange","grape","bell","lemon","cherry","orange",
  "grape","bar","lemon","cherry","orange","grape","bell","lemon",
  "cherry","orange","bell","lucky7","lemon","cherry","grape","wild",
  "lemon","cherry","orange","grape","bar","lemon","cherry","lemon",
  "cherry","orange","bell","lemon","cherry","lemon","cherry","orange",
  "grape","bell","bar","lemon","cherry","orange","lemon","bell",
  "wild","lemon","lucky7","lemon","cherry","grape","diamond","lemon",
  "cherry","orange","grape","orange","wild","lemon","scatter","cherry"
];
const REEL_3 = [
  "cherry","lemon","orange","grape","bell","cherry","lemon","orange",
  "grape","bar","cherry","lemon","orange","grape","bell","cherry",
  "lemon","orange","bell","lucky7","cherry","lemon","grape","wild",
  "cherry","lemon","orange","grape","bar","cherry","lemon","cherry",
  "lemon","orange","bell","cherry","lemon","cherry","lemon","orange",
  "grape","wild","bar","cherry","lemon","orange","cherry","lemon",
  "wild","cherry","lucky7","cherry","lemon","grape","diamond","cherry",
  "lemon","orange","grape","orange","wild","cherry","scatter","orange"
];
const REEL_4 = [
  "cherry","lemon","orange","grape","bell","cherry","lemon","orange",
  "grape","bar","cherry","lemon","orange","grape","bell","cherry",
  "lemon","orange","bell","lucky7","cherry","lemon","grape","wild",
  "cherry","lemon","orange","grape","bar","cherry","lemon","cherry",
  "lemon","orange","bell","cherry","lemon","cherry","lemon","orange",
  "grape","bell","cherry","lemon","cherry","orange","cherry","lemon",
  "wild","cherry","lucky7","cherry","lemon","grape","diamond","cherry",
  "lemon","orange","grape","orange","wild","bar","scatter","cherry"
];
const REEL_5 = [
  "cherry","lemon","orange","grape","bell","cherry","lemon","orange",
  "grape","bar","cherry","lemon","orange","grape","bell","cherry",
  "lemon","orange","bell","lucky7","cherry","lemon","grape","wild",
  "cherry","lemon","orange","grape","bar","cherry","lemon","cherry",
  "lemon","orange","bell","cherry","lemon","cherry","lemon","orange",
  "grape","bell","cherry","lemon","cherry","orange","cherry","lemon",
  "wild","cherry","lucky7","cherry","lemon","grape","diamond","cherry",
  "lemon","orange","grape","orange","wild","bar","scatter","cherry"
];

const REEL_STRIPS = [REEL_1, REEL_2, REEL_3, REEL_4, REEL_5];
const STOPS_PER_REEL = 64;

const PAY_TABLE = {
  cherry:  { 3: 5,   4: 15,  5: 50   },
  lemon:   { 3: 5,   4: 15,  5: 50   },
  orange:  { 3: 8,   4: 25,  5: 75   },
  grape:   { 3: 8,   4: 25,  5: 75   },
  bell:    { 3: 15,  4: 50,  5: 200  },
  bar:     { 3: 25,  4: 75,  5: 500  },
  lucky7:  { 3: 50,  4: 200, 5: 1000 },
  diamond: { 3: 100, 4: 500, 5: 5000 },
  wild:    { 3: 100, 4: 500, 5: 5000 },
};

const SCATTER_PAY_TABLE = { 3: 5, 4: 20, 5: 100 };
const FREE_SPIN_AWARDS = { 3: 10, 4: 15, 5: 25 };

const PAYLINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,0,0],[2,2,1,2,2],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,1,2,2],[2,2,1,0,0],[0,2,0,2,0],
];

const SYMBOL_ORDER = [
  "cherry","lemon","orange","grape","bell","bar","lucky7","diamond","wild","scatter"
];

function generateGridFromStops(stops) {
  const grid = [];
  for (let col = 0; col < 5; col++) {
    const strip = REEL_STRIPS[col];
    const stop = stops[col];
    const colSymbols = [];
    for (let row = 0; row < 3; row++) {
      colSymbols.push(strip[(stop + row) % STOPS_PER_REEL]);
    }
    grid.push(colSymbols);
  }
  return grid;
}

function evaluateLine(symbols) {
  let firstNonWild = symbols.find(s => s !== "wild" && s !== "scatter");
  if (!firstNonWild && symbols[0] === "wild") firstNonWild = "wild";
  if (!firstNonWild) return null;
  const matchSymbol = firstNonWild;
  let count = 0;
  for (let i = 0; i < 5; i++) {
    if (symbols[i] === matchSymbol || symbols[i] === "wild") count++;
    else break;
  }
  if (count < 3) return null;
  return { symbol: matchSymbol, count };
}

function evaluateGrid(grid, betPerLine, multiplier) {
  let totalWin = 0;
  const symbolContribs = {};

  PAYLINES.forEach((payline) => {
    const symbolsOnLine = payline.map((row, col) => grid[col][row]);
    const result = evaluateLine(symbolsOnLine);
    if (result) {
      const payEntry = PAY_TABLE[result.symbol];
      const payoutMult = payEntry ? payEntry[result.count] : 0;
      const payout = payoutMult * betPerLine * multiplier;
      if (payout > 0) {
        totalWin += payout;
        if (!symbolContribs[result.symbol]) symbolContribs[result.symbol] = 0;
        symbolContribs[result.symbol] += payout;
      }
    }
  });

  let scatterCount = 0;
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (grid[c][r] === "scatter") scatterCount++;
    }
  }

  let scatterPayout = 0;
  if (scatterCount >= 3) {
    const scatterMult = SCATTER_PAY_TABLE[scatterCount] || SCATTER_PAY_TABLE[5];
    scatterPayout = scatterMult * betPerLine * 20 * multiplier;
    totalWin += scatterPayout;
    if (!symbolContribs["scatter"]) symbolContribs["scatter"] = 0;
    symbolContribs["scatter"] += scatterPayout;
  }

  return { totalWin, scatterCount, symbolContribs };
}

function run(numSpins) {
  console.log(`\n🎰 RTP Calculator - Monte Carlo Simulation`);
  console.log(`   Simulating ${numSpins.toLocaleString()} spins...\n`);

  const betPerLine = 1;
  const totalBetPerSpin = betPerLine * 20;
  let baseGameWagered = 0, baseGameWon = 0;
  let freeSpinWon = 0;
  let totalHits = 0;
  const symbolContribs = {};
  SYMBOL_ORDER.forEach(s => { symbolContribs[s] = 0; });
  const payouts = [];

  const startTime = Date.now();

  for (let i = 0; i < numSpins; i++) {
    const stops = Array.from({ length: 5 }, () => Math.floor(Math.random() * STOPS_PER_REEL));
    const grid = generateGridFromStops(stops);
    const result = evaluateGrid(grid, betPerLine, 1);

    baseGameWagered += totalBetPerSpin;
    baseGameWon += result.totalWin;
    if (result.totalWin > 0) totalHits++;
    payouts.push(result.totalWin);

    for (const [sym, val] of Object.entries(result.symbolContribs)) {
      symbolContribs[sym] += val;
    }

    if (result.scatterCount >= 3) {
      const freeSpinCount = FREE_SPIN_AWARDS[result.scatterCount] || 10;
      for (let f = 0; f < freeSpinCount; f++) {
        const fsStops = Array.from({ length: 5 }, () => Math.floor(Math.random() * STOPS_PER_REEL));
        const fsGrid = generateGridFromStops(fsStops);
        for (let c = 0; c < 5; c++) {
          if (fsGrid[c][0] === "wild" || fsGrid[c][1] === "wild" || fsGrid[c][2] === "wild") {
            fsGrid[c][0] = "wild"; fsGrid[c][1] = "wild"; fsGrid[c][2] = "wild";
          }
        }
        const fsResult = evaluateGrid(fsGrid, betPerLine, 2);
        freeSpinWon += fsResult.totalWin;
        for (const [sym, val] of Object.entries(fsResult.symbolContribs)) {
          symbolContribs[sym] += val;
        }
      }
    }

    if (i > 0 && i % 1_000_000 === 0) {
      process.stdout.write(`   Progress: ${(i / numSpins * 100).toFixed(0)}%\r`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const baseRTP = (baseGameWon / baseGameWagered) * 100;
  const freeSpinRTP = (freeSpinWon / baseGameWagered) * 100;
  const combinedRTP = ((baseGameWon + freeSpinWon) / baseGameWagered) * 100;
  const hitFrequency = (totalHits / numSpins) * 100;

  const meanPayout = payouts.reduce((a, b) => a + b, 0) / payouts.length;
  const variance = payouts.reduce((sum, p) => sum + Math.pow(p - meanPayout, 2), 0) / payouts.length;
  const volatilityIndex = Math.sqrt(variance) / totalBetPerSpin;

  console.log(`   Completed in ${elapsed}s\n`);
  console.log(`   ┌─────────────────────────────────────┐`);
  console.log(`   │  Base Game RTP:    ${baseRTP.toFixed(4)}%          │`);
  console.log(`   │  Free Spin RTP:    ${freeSpinRTP.toFixed(4)}%           │`);
  console.log(`   │  Combined RTP:     ${combinedRTP.toFixed(4)}%          │`);
  console.log(`   │  Hit Frequency:    ${hitFrequency.toFixed(2)}%            │`);
  console.log(`   │  Volatility Index: ${volatilityIndex.toFixed(4)}             │`);
  console.log(`   └─────────────────────────────────────┘\n`);

  console.log(`   Symbol Contribution Breakdown:`);
  console.log(`   ${"─".repeat(45)}`);
  for (const sym of SYMBOL_ORDER) {
    const contribRTP = (symbolContribs[sym] / baseGameWagered) * 100;
    const bar = "█".repeat(Math.max(1, Math.round(contribRTP * 2)));
    console.log(`   ${sym.padEnd(10)} ${contribRTP.toFixed(4).padStart(8)}%  ${bar}`);
  }
  console.log();
}

const numSpins = parseInt(process.argv[2]) || 10_000_000;
run(numSpins);
