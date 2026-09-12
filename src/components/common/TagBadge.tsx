import React from 'react';
import { RefereeCustomTag } from '@/types/refstudio';
import { AlertTriangle, ShieldAlert, Award, Crown, Flame, Eye } from 'lucide-react';

interface TagBadgeProps {
  tag: RefereeCustomTag | string;
  size?: 'sm' | 'md';
}

export const TagBadge: React.FC<TagBadgeProps> = ({ tag, size = 'md' }) => {
  const getTagMeta = () => {
    switch (tag) {
      case 'proteste frequenti':
        return {
          label: 'Proteste Frequenti',
          style: 'bg-[#FF334B]/15 text-[#FF334B] border-[#FF334B]/40',
          icon: <Flame className="w-3 h-3 mr-1 text-[#FF334B]" />,
        };
      case 'simulatore':
        return {
          label: 'Simulatore',
          style: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          icon: <ShieldAlert className="w-3 h-3 mr-1 text-amber-300" />,
        };
      case 'corretto':
        return {
          label: 'Corretto / Esemplare',
          style: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40',
          icon: <Award className="w-3 h-3 mr-1 text-[#CCFF00]" />,
        };
      case 'leader squadra':
        return {
          label: 'Leader Squadra',
          style: 'bg-[#181C28] text-sky-400 border-sky-500/40',
          icon: <Crown className="w-3 h-3 mr-1 text-sky-400" />,
        };
      case 'aggressivo':
        return {
          label: 'Aggressivo nei contrasti',
          style: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
          icon: <AlertTriangle className="w-3 h-3 mr-1 text-purple-300" />,
        };
      case 'osservare':
        return {
          label: 'Da Osservare',
          style: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40 shadow-[0_0_8px_rgba(204,255,0,0.2)]',
          icon: <Eye className="w-3 h-3 mr-1 text-[#CCFF00]" />,
        };
      default:
        return {
          label: tag,
          style: 'bg-[#181C28] text-slate-300 border-[#282E40]',
          icon: null,
        };
    }
  };

  const { label, style, icon } = getTagMeta();
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${style} ${padding} transition-all`}
    >
      {icon}
      {label}
    </span>
  );
};
