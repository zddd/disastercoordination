/**
 * Client-side help request history using localStorage.
 * Since /help is a public page without authentication requirement,
 * we track submitted help IDs locally so users can see their past requests.
 */

const STORAGE_KEY = "dc_help_history";

export interface HelpHistoryEntry {
  help_id: string;
  created_at: string; // ISO timestamp
}

/**
 * Reads help history from localStorage.
 * Returns entries sorted newest first.
 */
export function getHelpHistory(): HelpHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: HelpHistoryEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

/**
 * Adds a help ID to the history.
 * Keeps at most 50 entries (oldest trimmed).
 */
export function addHelpToHistory(help_id: string): void {
  if (typeof window === "undefined") return;
  const entries = getHelpHistory();
  // Avoid duplicates
  const exists = entries.find(e => e.help_id === help_id);
  if (exists) return;
  entries.push({ help_id, created_at: new Date().toISOString() });
  // Keep at most 50
  if (entries.length > 50) {
    entries.splice(50);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full — ignore
  }
}

/**
 * Clears all help history.
 */
export function clearHelpHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
