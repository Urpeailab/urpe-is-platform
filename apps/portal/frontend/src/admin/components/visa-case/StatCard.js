import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  trendValue,
  variant = 'default' // default, success, warning, gold
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          icon: 'text-emerald-600 bg-emerald-100',
          value: 'text-emerald-600'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          icon: 'text-amber-600 bg-amber-100',
          value: 'text-amber-600'
        };
      case 'gold':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-600 bg-blue-100',
          value: 'text-blue-600'
        };
      default:
        return {
          bg: 'bg-white border-gray-200',
          icon: 'text-gray-600 bg-gray-100',
          value: 'text-gray-900'
        };
    }
  };

  const styles = getVariantStyles();

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-slate-400" />;
  };

  return (
    <div className={`
      rounded-2xl border p-6 transition-all hover:scale-[1.02] shadow-sm
      ${styles.bg}
    `}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${styles.icon}`}>
          {Icon && <Icon className="h-5 w-5" />}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            {getTrendIcon()}
            <span className={trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}>
              {trendValue}
            </span>
          </div>
        )}
      </div>
      
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className={`text-3xl font-bold tracking-tight ${styles.value}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
