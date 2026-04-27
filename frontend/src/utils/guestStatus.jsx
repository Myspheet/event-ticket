import React from 'react';
import { CheckCircle2, CircleDot, LogOut, Ban } from 'lucide-react';

export const STATUS = {
  PENDING: 'pending',
  INSIDE: 'inside',
  STEPPED_OUT: 'stepped_out',
  DEPARTED: 'departed',
};

export function statusLabel(status) {
  switch (status) {
    case STATUS.INSIDE: return 'Inside';
    case STATUS.STEPPED_OUT: return 'Stepped Out';
    case STATUS.DEPARTED: return 'Departed';
    case STATUS.PENDING:
    default: return 'Not Yet In';
  }
}

export function StatusBadge({ status, size = 12, className = '' }) {
  const map = {
    [STATUS.INSIDE]: { cls: 'badge-green', Icon: CheckCircle2 },
    [STATUS.STEPPED_OUT]: { cls: 'badge-amber', Icon: LogOut },
    [STATUS.DEPARTED]: { cls: 'badge-red', Icon: Ban },
    [STATUS.PENDING]: { cls: 'badge-gray', Icon: CircleDot },
  };
  const { cls, Icon } = map[status] || map[STATUS.PENDING];
  return (
    <span className={`badge ${cls} flex items-center gap-1 w-fit ${className}`}>
      <Icon size={size} />
      {statusLabel(status)}
    </span>
  );
}

// Derive status from a possibly-legacy guest record (when only `checked_in` is set)
export function guestStatus(g) {
  if (!g) return STATUS.PENDING;
  if (g.status) return g.status;
  if (g.checked_in) return STATUS.INSIDE;
  if (g.checked_out_at) return STATUS.STEPPED_OUT;
  return STATUS.PENDING;
}
