import { Radio, Lock, CheckCircle2, Clock, XCircle, RotateCcw } from 'lucide-react';

const MAP = {
  open: { cls: 'badge-open', label: 'Live', Icon: Radio },
  closed: { cls: 'badge-closed', label: 'Awaiting result', Icon: Lock },
  resolved: { cls: 'badge-resolved', label: 'Settled', Icon: CheckCircle2 },
  pending: { cls: 'badge-pending', label: 'In review', Icon: Clock },
  rejected: { cls: 'badge-rejected', label: 'Rejected', Icon: XCircle },
  refunded: { cls: 'badge-refunded', label: 'Refunded', Icon: RotateCcw },
};

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.pending;
  return (
    <span className={s.cls}>
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}
