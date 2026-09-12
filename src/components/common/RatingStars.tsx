import React from 'react';

interface RatingStarsProps {
  value: number; // 1 to 5
  type?: 'technical' | 'aggression';
  onChange?: (val: number) => void;
  readOnly?: boolean;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  value,
  type = 'technical',
  onChange,
  readOnly = true,
}) => {
  const bars = [1, 2, 3, 4, 5];

  const getColor = (index: number) => {
    const isFilled = index <= value;
    if (!isFilled) return 'bg-[#181C28] border-[#293144]';
    if (type === 'technical') {
      return 'bg-[#CCFF00] border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.4)]';
    }
    return 'bg-[#FF334B] border-[#FF334B] shadow-[0_0_10px_rgba(255,51,75,0.4)]';
  };

  return (
    <div className="flex items-center gap-1.5" title={`Livello: ${value}/5`}>
      {bars.map((bar) => (
        <button
          key={bar}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(bar)}
          className={`h-3.5 w-3.5 rounded-[3px] border transition-all ${getColor(bar)} ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
        />
      ))}
      <span className={`text-xs font-mono font-bold ml-1 ${type === 'technical' ? 'text-[#CCFF00]' : 'text-rose-400'}`}>
        {value}/5
      </span>
    </div>
  );
};
