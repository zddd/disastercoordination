/**
 * Disaster level mapping.
 * Backend stores: red / orange / yellow / blue
 * Frontend displays: Chinese labels with daisyUI badge colors
 */
export const LEVEL_MAP: Record<string, { label: string; badge: string }> = {
  red:    { label: "I级 · 特别重大", badge: "badge-error" },
  orange: { label: "II级 · 重大",   badge: "badge-warning" },
  yellow: { label: "III级 · 较重",   badge: "badge-info" },
  blue:   { label: "IV级 · 一般",    badge: "badge-ghost" },
};

/** Options for select dropdowns */
export const LEVEL_OPTIONS = [
  { value: "red",    label: "I级 · 特别重大" },
  { value: "orange", label: "II级 · 重大" },
  { value: "yellow", label: "III级 · 较重" },
  { value: "blue",   label: "IV级 · 一般" },
];

/**
 * Disaster type mapping.
 */
export const TYPE_MAP: Record<string, string> = {
  earthquake: "地震", flood: "洪涝", typhoon: "台风",
  epidemic: "疫情", other: "其他",
};

export const TYPE_OPTIONS = Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v }));
