import React from 'react';
import { Badge } from '../../../components/ui/badge';
import { CheckCircle, Clock, Lock, Circle } from 'lucide-react';

// Timeline stage component following Fitts' Law - large clickable areas
const TimelineStage = ({ stage, isActive, isCompleted, isPaid, isSelected, onClick }) => {
  const getStageStyle = () => {
    if (isSelected) return 'bg-blue-600 border-blue-500 text-white ring-4 ring-blue-500/30';
    if (isCompleted || isPaid) return 'bg-emerald-500 border-emerald-400 text-white';
    if (isActive) return 'bg-blue-500 border-blue-400 text-white';
    return 'bg-gray-200 border-gray-300 text-gray-500';
  };

  const getIcon = () => {
    if (isCompleted || isPaid) return <CheckCircle className="h-4 w-4" />;
    if (isActive) return <Clock className="h-4 w-4" />;
    if (stage.status === 'locked') return <Lock className="h-3 w-3" />;
    return <Circle className="h-3 w-3" />;
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-3 rounded-xl transition-all
        hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50
        min-w-[80px]
      `}
    >
      <div className={`
        w-10 h-10 rounded-full border-2 flex items-center justify-center
        transition-all ${getStageStyle()}
      `}>
        {getIcon()}
      </div>
      <span className={`text-xs font-medium ${isSelected ? 'text-blue-600 font-semibold' : isActive ? 'text-blue-600' : 'text-gray-500'}`}>
        Etapa {stage.stageNumber}
      </span>
      {isPaid && (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">
          Pagada
        </Badge>
      )}
    </button>
  );
};

export const VisaTimeline = ({ stages, currentStage, selectedStage, onStageClick }) => {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Progreso del Caso</h3>
      
      <div className="relative">
        {/* Connection line */}
        <div className="absolute top-8 left-8 right-8 h-0.5 bg-gray-200" />
        
        {/* Progress line */}
        <div 
          className="absolute top-8 left-8 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
          style={{ width: `calc(${((currentStage - 1) / (stages.length - 1)) * 100}% - 32px)` }}
        />
        
        {/* Stages */}
        <div className="relative flex justify-between overflow-x-auto pb-2">
          {stages.map((stage, index) => (
            <TimelineStage
              key={stage._id || index}
              stage={stage}
              isActive={stage.stageNumber === currentStage}
              isCompleted={stage.status === 'completed'}
              isPaid={stage.paidAmount > 0}
              isSelected={selectedStage?.stageNumber === stage.stageNumber}
              onClick={() => onStageClick?.(stage)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisaTimeline;
