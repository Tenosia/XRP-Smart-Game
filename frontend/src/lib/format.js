export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function fmtXLM(n, dp = 2) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function pct(n) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

export function shortAddr(a) {
  if (!a) return '';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

// "2d 4h", "3h 12m", "5m 20s", or "Closed"
export function timeLeft(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'Closed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Urgency tier by time left until funding closes (only while open).
export function urgencyTier(closesAt, status) {
  if (status !== 'open') return null;
  const ms = Date.parse(closesAt) - Date.now();
  if (ms <= 0) return null;
  if (ms < 6 * 3600_000) return 'red';
  if (ms < 48 * 3600_000) return 'yellow';
  return 'green';
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TX_LABELS = {
  deposit: 'Deposit',
  withdraw: 'Withdrawal',
  contribution: 'Selection placed',
  payout: 'Winnings',
  owner_payout: 'Creator earnings',
  refund: 'Refund',
  idea_fee: 'Listing fee',
  idea_fee_refund: 'Listing fee refund',
  platform_fee: 'Platform fee',
  platform_withdraw: 'Platform withdrawal',
};
export function txLabel(type) {
  return TX_LABELS[type] || type;
}
