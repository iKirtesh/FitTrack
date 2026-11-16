export const DASHBOARD_CARDS = [
  { id: 'today', label: "Today's activity" },
  { id: 'workout', label: "Today's workout" },
  { id: 'week', label: 'This week' },
  { id: 'weight', label: 'Weight & goal' },
  { id: 'chart', label: 'Weekly activity chart' },
  { id: 'recent', label: 'Recent activity' },
  { id: 'records', label: 'Recent personal records' },
] as const;
export type DashboardCardId = (typeof DASHBOARD_CARDS)[number]['id'];
export const DEFAULT_CARDS: DashboardCardId[] = DASHBOARD_CARDS.map((c) => c.id);
