export const SOURCE_LABELS: Record<string, string> = {
  "owner-manual": "Owner Manual",
  "quick-start-guide": "Quick Start Guide",
  "selection-chart": "Selection Chart",
};

export interface Citation {
  source: string;
  label: string;
  page: number;
  section: string;
  excerpt?: string;
}
