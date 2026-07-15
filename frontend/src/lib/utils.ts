import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with proper conflict resolution.
 * Uses clsx for conditional classes and tailwind-merge to resolve conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date to YYYY-MM-DD HH:mm local time.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats distance in meters to human-readable string.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Formats waiting time in minutes to human-readable string.
 */
export function formatWaitingTime(minutes: number): string {
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}小时${mins > 0 ? `${mins}分钟` : ""}`;
}
