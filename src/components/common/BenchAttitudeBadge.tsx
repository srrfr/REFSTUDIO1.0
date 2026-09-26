import React from 'react';
import { BenchAttitudeTag } from '@/types/refstudio';
import { ShieldCheck, Activity, AlertTriangle, AlertOctagon, Flame, HelpCircle, Check } from 'lucide-react';

interface BenchAttitudeBadgeProps {
  attitude?: BenchAttitudeTag | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isSelected?: boolean;
  showDescription?: boolean;
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;
}

export interface BenchAttitudeMeta {
  tag: BenchAttitudeTag | null;
  label: string;
  description: string;
  style: string;
  activeStyle: string;
  dotColor: string;
  icon: React.ReactNode;
}

export const getBenchAttitudeMeta = (attitude?: string): BenchAttitudeMeta => {
  const norm = (attitude || '').toLowerCase().trim();
  switch (norm) {
    case 'esemplare':
      return {
        tag: 'esemplare',
        label: 'Esemplare',
        description: 'Panchina corretta, calma e collaborativa con la terna',
        style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25',
        activeStyle: 'bg-emerald-500/30 text-emerald-100 border-emerald-400 ring-2 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
        dotColor: 'bg-emerald-400',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
      };
    case 'vivace':
      return {
        tag: 'vivace',
        label: 'Vivace',
        description: 'Incita costantemente la squadra, proteste fisiologiche e sonore',
        style: 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25',
        activeStyle: 'bg-sky-500/30 text-sky-100 border-sky-400 ring-2 ring-sky-500/60 shadow-[0_0_12px_rgba(56,189,248,0.35)]',
        dotColor: 'bg-sky-400',
        icon: <Activity className="w-3.5 h-3.5 text-sky-400" />,
      };
    case 'al limite':
      return {
        tag: 'al limite',
        label: 'Al Limite',
        description: 'Spesso fuori dall\'area tecnica, pressione continua sull\'assistente',
        style: 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25',
        activeStyle: 'bg-amber-500/30 text-amber-100 border-amber-400 ring-2 ring-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
        dotColor: 'bg-amber-400',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
      };
    case 'problematica':
      return {
        tag: 'problematica',
        label: 'Problematica',
        description: 'Contestazioni reiterate, provocazioni verso gli avversari e proteste veementi',
        style: 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25',
        activeStyle: 'bg-rose-500/30 text-rose-100 border-rose-400 ring-2 ring-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
        dotColor: 'bg-rose-400',
        icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />,
      };
    case 'esplosiva':
      return {
        tag: 'esplosiva',
        label: 'Esplosiva',
        description: 'Altissimo rischio sanzioni (ammonizioni/espulsioni a tecnici e dirigenti), clima intimidatorio',
        style: 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:bg-red-500/30',
        activeStyle: 'bg-red-500/35 text-red-100 border-red-400 ring-2 ring-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.5)]',
        dotColor: 'bg-red-500',
        icon: <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />,
      };
    default:
      return {
        tag: null,
        label: attitude || 'Da valutare',
        description: 'Atteggiamento della panchina non ancora censito o regolare',
        style: 'bg-[#181C28] text-slate-400 border-[#282E40] hover:bg-[#1E2333]',
        activeStyle: 'bg-[#222738] text-white border-slate-400 ring-2 ring-slate-400/50',
        dotColor: 'bg-slate-500',
        icon: <HelpCircle className="w-3.5 h-3.5 text-slate-500" />,
      };
  }
};

export const BenchAttitudeBadge: React.FC<BenchAttitudeBadgeProps> = ({
  attitude,
  size = 'md',
  isSelected = false,
  showDescription = false,
  showTooltip = true,
  className = '',
  onClick,
}) => {
  const meta = getBenchAttitudeMeta(attitude);

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-xs gap-2',
  }[size];

  const content = (
    <span
      className={`inline-flex items-center font-black rounded-xl border transition-all select-none ${sizeClasses} ${
        isSelected ? meta.activeStyle : meta.style
      } ${className}`}
      title={showTooltip ? `${meta.label}: ${meta.description}` : undefined}
    >
      <span className="flex-shrink-0 flex items-center">{meta.icon}</span>
      <span className="truncate tracking-wide">{meta.label}</span>
      {isSelected && (
        <span className="ml-0.5 flex-shrink-0">
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus:outline-none transition-transform active:scale-95 text-left"
      >
        {content}
        {showDescription && (
          <span className="block text-[10px] text-slate-400 font-normal mt-0.5 pl-1 leading-tight">
            {meta.description}
          </span>
        )}
      </button>
    );
  }

  if (showDescription) {
    return (
      <div className="inline-flex flex-col">
        {content}
        <span className="text-[10px] text-slate-400 font-normal mt-0.5 pl-1 leading-tight">
          {meta.description}
        </span>
      </div>
    );
  }

  return content;
};
