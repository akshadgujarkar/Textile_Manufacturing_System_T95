import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | 'info';
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  trend,
  onClick,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: 'var(--md-sys-color-primary-container)',
          text: 'var(--md-sys-color-on-primary-container)',
          iconBg: 'rgba(103, 80, 164, 0.18)',
        };
      case 'secondary':
        return {
          bg: 'var(--md-sys-color-secondary-container)',
          text: 'var(--md-sys-color-on-secondary-container)',
          iconBg: 'rgba(98, 91, 113, 0.18)',
        };
      case 'tertiary':
        return {
          bg: 'var(--md-sys-color-tertiary-container)',
          text: 'var(--md-sys-color-on-tertiary-container)',
          iconBg: 'rgba(125, 82, 96, 0.18)',
        };
      case 'success':
        return {
          bg: 'var(--md-sys-color-success-container)',
          text: 'var(--md-sys-color-on-success-container)',
          iconBg: 'rgba(30, 126, 52, 0.18)',
        };
      case 'warning':
        return {
          bg: 'var(--md-sys-color-warning-container)',
          text: 'var(--md-sys-color-on-warning-container)',
          iconBg: 'rgba(154, 107, 0, 0.18)',
        };
      case 'error':
        return {
          bg: 'var(--md-sys-color-error-container)',
          text: 'var(--md-sys-color-on-error-container)',
          iconBg: 'rgba(179, 38, 30, 0.18)',
        };
      default:
        return {
          bg: 'var(--md-sys-color-info-container)',
          text: 'var(--md-sys-color-on-info-container)',
          iconBg: 'rgba(0, 99, 155, 0.18)',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      className={`m3-card ${onClick ? 'm3-card-interactive' : ''}`}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '140px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, marginTop: '4px', letterSpacing: '-0.5px' }}>
            {value}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: styles.iconBg,
          }}
        >
          {icon}
        </div>
      </div>

      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.8125rem' }}>
          {trend && (
            <span
              style={{
                fontWeight: 600,
                color: trend.isPositive ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-error)',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && <span style={{ opacity: 0.8 }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
