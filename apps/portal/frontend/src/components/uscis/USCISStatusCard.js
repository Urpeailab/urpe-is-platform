import React from 'react';
import { ChevronRight } from 'lucide-react';

const STATUS_COLORS = {
  approved: '#34C759',
  processing: '#FF9500',
  rfe: '#FF9500',
  denied: '#FF3B30',
  unknown: '#8E8E93',
};

export const USCISStatusCard = ({ receiptNumber, status, statusTitle, formType, lastUpdated, onClick }) => {
  const dotColor = STATUS_COLORS[status] || STATUS_COLORS.unknown;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-[#E5E5EA]"
      data-testid="uscis-status-card"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
          <span className="text-xs font-bold" style={{ color: '#1C3A6B' }}>USCIS Status</span>
        </div>
        <ChevronRight className="h-4 w-4" style={{ color: '#8E8E93' }} />
      </div>
      <p className="font-bold text-sm" style={{ color: '#000' }}>{receiptNumber}</p>
      <p className="text-xs mt-0.5" style={{ color: '#333' }}>{statusTitle}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs" style={{ color: '#8E8E93' }}>{lastUpdated || ''}</span>
        <span className="text-xs font-medium" style={{ color: '#8E8E93' }}>{formType}</span>
      </div>
    </button>
  );
};
