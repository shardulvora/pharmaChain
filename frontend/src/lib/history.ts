import type { BatchStatus } from "./api";

export interface HistoryEntry {
  batchId: string;
  drugName: string;
  status: BatchStatus;
  timestamp: number; // ms since epoch
}

const STORAGE_KEY = "pillchain_history";
const MAX_ENTRIES = 20;

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(entry: Omit<HistoryEntry, "timestamp">): void {
  const history = getHistory();

  // Remove any existing entry for the same batchId
  const filtered = history.filter((h) => h.batchId !== entry.batchId);

  // Add new entry at the front
  filtered.unshift({ ...entry, timestamp: Date.now() });

  // Trim to max entries
  const trimmed = filtered.slice(0, MAX_ENTRIES);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
