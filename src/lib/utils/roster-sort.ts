import { Player } from '@/types/refstudio';

export type RosterSortField =
  | 'ROLE'
  | 'BIRTH_YEAR'
  | 'APPEARANCES'
  | 'GOALS'
  | 'YELLOW_CARDS'
  | 'RED_CARDS'
  | 'NAME';

export type SortDirection = 'asc' | 'desc';

export interface SortOptionItem {
  id: RosterSortField;
  label: string;
  shortLabel: string;
  icon?: string;
  defaultDirection: SortDirection;
}

export const ROSTER_SORT_OPTIONS: SortOptionItem[] = [
  {
    id: 'ROLE',
    label: 'Ruolo (Portieri ➔ Attaccanti)',
    shortLabel: 'Ruolo',
    defaultDirection: 'asc',
  },
  {
    id: 'BIRTH_YEAR',
    label: 'Anno di Nascita / Età',
    shortLabel: 'Anno / Età',
    defaultDirection: 'desc',
  },
  {
    id: 'APPEARANCES',
    label: 'Presenze',
    shortLabel: 'Presenze',
    defaultDirection: 'desc',
  },
  {
    id: 'GOALS',
    label: 'Reti Segnate',
    shortLabel: 'Reti ⚽',
    defaultDirection: 'desc',
  },
  {
    id: 'YELLOW_CARDS',
    label: 'Ammonizioni (Gialli)',
    shortLabel: 'Ammonizioni 🟨',
    defaultDirection: 'desc',
  },
  {
    id: 'RED_CARDS',
    label: 'Espulsioni (Rossi)',
    shortLabel: 'Espulsioni 🟥',
    defaultDirection: 'desc',
  },
  {
    id: 'NAME',
    label: 'Cognome (A-Z)',
    shortLabel: 'Alfabetico',
    defaultDirection: 'asc',
  },
];

/**
 * Pesi ufficiali ruoli calcio:
 * 1: Portieri (POR)
 * 2: Difensori (DIF)
 * 3: Centrocampisti (CEN)
 * 4: Attaccanti (ATT)
 * 5: Altro / Sconosciuto
 */
export function getRoleWeight(role?: string): number {
  if (!role) return 5;
  const r = role.toUpperCase().trim();
  if (r === 'POR' || r === 'P' || r.startsWith('PORT')) return 1;
  if (r === 'DIF' || r === 'D' || r.startsWith('DIF')) return 2;
  if (r === 'CEN' || r === 'C' || r.startsWith('CENT')) return 3;
  if (r === 'ATT' || r === 'A' || r.startsWith('ATT')) return 4;
  return 5;
}

export function getRolePluralLabel(weight: number): string {
  switch (weight) {
    case 1:
      return 'Portieri';
    case 2:
      return 'Difensori';
    case 3:
      return 'Centrocampisti';
    case 4:
      return 'Attaccanti';
    default:
      return 'Altri';
  }
}

export function getRoleIcon(weight: number): string {
  switch (weight) {
    case 1:
      return '🧤';
    case 2:
      return '🛡️';
    case 3:
      return '⚙️';
    case 4:
      return '⚡';
    default:
      return '📋';
  }
}

/**
 * Estrae l'anno di nascita da birthDate (formati: DD-MM-YYYY, YYYY-MM-DD, ecc.) o calcola da età
 */
export function getPlayerBirthYear(p: Player): number {
  if (p.birthDate) {
    const parts = p.birthDate.split(/[-/.]/);
    if (parts.length === 3) {
      const y1 = parseInt(parts[0], 10);
      const y3 = parseInt(parts[2], 10);
      if (y3 >= 1900 && y3 <= 2100) return y3;
      if (y1 >= 1900 && y1 <= 2100) return y1;
    } else {
      const m = p.birthDate.match(/\b(19\d\d|20\d\d)\b/);
      if (m) return parseInt(m[1], 10);
    }
  }
  if (p.age && p.age > 0) {
    return new Date().getFullYear() - p.age;
  }
  return 0;
}

/**
 * Calcola l'età effettiva
 */
export function getPlayerEffectiveAge(p: Player): number | undefined {
  if (p.age && p.age > 0) return p.age;
  const y = getPlayerBirthYear(p);
  if (y > 1900) return new Date().getFullYear() - y;
  return undefined;
}

/**
 * Verifica corrispondenza ruolo (supporta sia POR che P, ecc.)
 */
export function matchesRosterRole(playerRole?: string, filterRole?: string): boolean {
  if (!filterRole || filterRole === 'ALL') return true;
  const pr = (playerRole || '').toUpperCase().trim();
  const fr = filterRole.toUpperCase().trim();

  if (fr === 'POR' || fr === 'P') return pr === 'POR' || pr === 'P' || pr.startsWith('PORT');
  if (fr === 'DIF' || fr === 'D') return pr === 'DIF' || pr === 'D' || pr.startsWith('DIF');
  if (fr === 'CEN' || fr === 'C') return pr === 'CEN' || pr === 'C' || pr.startsWith('CENT');
  if (fr === 'ATT' || fr === 'A') return pr === 'ATT' || pr === 'A' || pr.startsWith('ATT');

  return pr === fr;
}

/**
 * Ordina un elenco di calciatori secondo il criterio selezionato
 */
export function sortRoster(
  players: Player[],
  sortField: RosterSortField,
  direction: SortDirection
): Player[] {
  return [...players].sort((a, b) => {
    // 1. ORDINAMENTO PER RUOLO (Portieri -> Difensori -> Centrocampisti -> Attaccanti)
    if (sortField === 'ROLE') {
      const wA = getRoleWeight(a.role);
      const wB = getRoleWeight(b.role);
      if (wA !== wB) {
        return direction === 'asc' ? wA - wB : wB - wA;
      }
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 2. ORDINAMENTO PER ANNO DI NASCITA / ETÀ
    if (sortField === 'BIRTH_YEAR') {
      const yA = getPlayerBirthYear(a);
      const yB = getPlayerBirthYear(b);
      if (yA !== yB) {
        // desc: più giovani (anni più recenti es. 2008 prima di 1990)
        // asc: più esperti (anni più vecchi es. 1988 prima di 2005)
        return direction === 'desc' ? yB - yA : yA - yB;
      }
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 3. ORDINAMENTO PER PRESENZE
    if (sortField === 'APPEARANCES') {
      const diff = (b.appearances || 0) - (a.appearances || 0);
      if (diff !== 0) {
        return direction === 'desc' ? diff : -diff;
      }
      const gDiff = (b.goals || 0) - (a.goals || 0);
      if (gDiff !== 0) return gDiff;
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 4. ORDINAMENTO PER RETI
    if (sortField === 'GOALS') {
      const diff = (b.goals || 0) - (a.goals || 0);
      if (diff !== 0) {
        return direction === 'desc' ? diff : -diff;
      }
      const appDiff = (b.appearances || 0) - (a.appearances || 0);
      if (appDiff !== 0) return appDiff;
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 5. ORDINAMENTO PER AMMONIZIONI
    if (sortField === 'YELLOW_CARDS') {
      const diff = (b.yellowCards || 0) - (a.yellowCards || 0);
      if (diff !== 0) {
        return direction === 'desc' ? diff : -diff;
      }
      const rcDiff = (b.redCards || 0) - (a.redCards || 0);
      if (rcDiff !== 0) return rcDiff;
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 6. ORDINAMENTO PER ESPULSIONI
    if (sortField === 'RED_CARDS') {
      const diff = (b.redCards || 0) - (a.redCards || 0);
      if (diff !== 0) {
        return direction === 'desc' ? diff : -diff;
      }
      const ycDiff = (b.yellowCards || 0) - (a.yellowCards || 0);
      if (ycDiff !== 0) return ycDiff;
      return (a.lastName || '').localeCompare(b.lastName || '', 'it');
    }

    // 7. ORDINAMENTO ALFABETICO (COGNOME)
    if (sortField === 'NAME') {
      const res = (a.lastName || '').localeCompare(b.lastName || '', 'it');
      if (res !== 0) return direction === 'asc' ? res : -res;
      return (a.firstName || '').localeCompare(b.firstName || '', 'it');
    }

    return 0;
  });
}
