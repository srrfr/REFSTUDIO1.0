/**
 * REFSTUDIO - Admin Escalation Guard
 * Codice Amministratore Riservato: 280899
 */

export const ADMIN_PIN_SECRET = '280899';
const ADMIN_SESSION_KEY = 'refstudio_admin_session_token';

export function verifyAdminCode(code: string): boolean {
  if (!code) return false;
  return code.trim() === ADMIN_PIN_SECRET;
}

export function saveAdminSession() {
  if (typeof window !== 'undefined') {
    const sessionToken = btoa(`admin_authenticated_${Date.now()}_${ADMIN_PIN_SECRET}`);
    localStorage.setItem(ADMIN_SESSION_KEY, sessionToken);
  }
}

export function clearAdminSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

export function checkIsAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!token) return false;
  try {
    const decoded = atob(token);
    return decoded.includes(ADMIN_PIN_SECRET);
  } catch {
    return false;
  }
}
