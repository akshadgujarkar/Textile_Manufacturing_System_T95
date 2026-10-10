import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'secondary';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, label }) => {
  const normalized = (status || '').toLowerCase();

  const getAutoVariant = (): 'success' | 'warning' | 'error' | 'info' | 'secondary' => {
    if (variant) return variant;

    if (['passed', 'active', 'running', 'completed', 'in_stock', 'issued', 'open', 'recorded', 'matched'].includes(normalized)) {
      return 'success';
    }
    if (['pending', 'draft', 'loading', 'rework', 'idle', 'half_day'].includes(normalized)) {
      return 'warning';
    }
    if (['rejected', 'breakdown', 'cancelled', 'voided', 'closed', 'reversed', 'absent', 'scrapped', 'failed'].includes(normalized)) {
      return 'error';
    }
    if (['dispatched', 'loaded', 'maintenance', 'approved', 'present'].includes(normalized)) {
      return 'info';
    }
    return 'secondary';
  };

  const badgeVariant = getAutoVariant();
  const displayLabel = label || status.replace(/_/g, ' ');

  return (
    <span className={`m3-badge badge-${badgeVariant}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
        }}
      />
      {displayLabel}
    </span>
  );
};
