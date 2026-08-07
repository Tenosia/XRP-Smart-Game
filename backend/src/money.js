import { STROOPS_PER_XLM } from './config.js';

// All internal balances and pools are stored as integer STROOPS (1 XLM = 1e7 stroops)
// to avoid floating-point drift. Conversion to/from XLM happens only at the edges.

export function xlmToStroops(xlm) {
  // Round to nearest stroop to avoid 0.1+0.2 style artifacts.
  return Math.round(Number(xlm) * STROOPS_PER_XLM);
}

export function stroopsToXlm(stroops) {
  return Number(stroops) / STROOPS_PER_XLM;
}

// Format stroops as a 7-dp Stellar amount string (used for on-chain ops).
export function stroopsToAmountString(stroops) {
  const neg = stroops < 0;
  const abs = Math.abs(Math.trunc(stroops));
  const whole = Math.floor(abs / STROOPS_PER_XLM);
  const frac = String(abs % STROOPS_PER_XLM).padStart(7, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

// Split `total` stroops by basis-point weights, distributing rounding dust to the
// last bucket so the sum is exactly conserved.
export function splitByBps(total, bpsList) {
  const out = bpsList.map((bps) => Math.floor((total * bps) / 10000));
  const distributed = out.reduce((a, b) => a + b, 0);
  out[out.length - 1] += total - distributed;
  return out;
}

// Pro-rata distribution of `pot` among weights, conserving the total (dust to last).
export function proRata(pot, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.floor((pot * w) / totalWeight));
  const distributed = out.reduce((a, b) => a + b, 0);
  // Hand remaining dust to the largest weight to keep it fair.
  let maxIdx = 0;
  for (let i = 1; i < weights.length; i++) if (weights[i] > weights[maxIdx]) maxIdx = i;
  out[maxIdx] += pot - distributed;
  return out;
}
