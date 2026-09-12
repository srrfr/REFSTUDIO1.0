import React from 'react';
import { RoleCategory } from '@/types/refstudio';

interface RoleBadgeProps {
  role: RoleCategory | string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const getStyle = () => {
    switch (role) {
      case 'POR':
        return 'bg-[#181C28] text-amber-300 border-amber-500/30';
      case 'DIF':
        return 'bg-[#181C28] text-sky-400 border-sky-500/30';
      case 'CEN':
        return 'bg-[#181C28] text-[#CCFF00] border-[#CCFF00]/40 shadow-[0_0_8px_rgba(204,255,0,0.15)]';
      case 'ATT':
        return 'bg-[#181C28] text-rose-400 border-rose-500/30';
      default:
        return 'bg-[#181C28] text-slate-300 border-[#2A3144]';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${getStyle()}`}
    >
      {role}
    </span>
  );
};
