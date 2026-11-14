export type NavStyle = "text" | "icon-left" | "icon-top";

export type ViewLayout = "list" | "columns" | "table" | "calendar";
export type ViewStyle = "notebook" | "cards";
export type ViewRange =
  | "today" | "tomorrow" | "week" | "next7" | "upcoming" | "month"
  | "d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "w1" | "w2" | "w3";

export interface DailyView {
  style: ViewStyle;
  range: ViewRange;
}

/** Collections group by status, section or priority; Inbox by none, priority or collection. */
export type BoardGroupBy = "status" | "section" | "priority" | "none" | "collection";

export interface BoardViewMode {
  layout?: ViewLayout;
  style?: ViewStyle;
  groupBy?: BoardGroupBy;
}

export type BoardViewModes = Record<string, BoardViewMode>;
