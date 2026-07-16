import type { LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

export type DashboardBreakpoint = 'lg' | 'md' | 'sm' | 'xs';
export type DashboardWidgetType = 'text' | 'application-pipeline' | 'application-snapshot' | 'status-distribution' | 'application-activity';

export type DashboardWidgetInstance = {
  content?: string;
  id: string;
  type: DashboardWidgetType;
};

export type DashboardWidgetDefinition = {
  description: string;
  allowMultiple: boolean;
  id: DashboardWidgetType;
  title: string;
};

export const DASHBOARD_BREAKPOINTS: Record<DashboardBreakpoint, number> = {
  lg: 1200,
  md: 900,
  sm: 640,
  xs: 0
};

export const DASHBOARD_COLUMNS: Record<DashboardBreakpoint, number> = {
  lg: 12,
  md: 8,
  sm: 4,
  xs: 1
};

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Add editable, multi-line notes with bold and italic formatting.',
    allowMultiple: true
  },
  {
    id: 'application-pipeline',
    title: 'Application Pipeline',
    description: 'A Kanban view of every tracked job application.',
    allowMultiple: false
  },
  {
    id: 'application-snapshot',
    title: 'Search Snapshot',
    description: 'See your tracked, in-progress, interviewing, and offer totals at a glance.',
    allowMultiple: false
  },
  {
    id: 'status-distribution',
    title: 'Status Distribution',
    description: 'Compare the number of applications in each stage of your pipeline.',
    allowMultiple: false
  },
  {
    id: 'application-activity',
    title: 'Application Activity',
    description: 'Track applications submitted across the last six months.',
    allowMultiple: false
  }
];

export const DEFAULT_WIDGET_INSTANCES: DashboardWidgetInstance[] = [
  {
    id: 'application-pipeline',
    type: 'application-pipeline'
  }
];

const DEFAULT_ITEMS: Record<DashboardBreakpoint, Record<DashboardWidgetType, Omit<LayoutItem, 'i' | 'y'>>> = {
  lg: {
    text: { x: 0, w: 7, h: 4, minW: 3, minH: 3 },
    'application-pipeline': { x: 0, w: 12, h: 11, minW: 6, minH: 7 },
    'application-snapshot': { x: 0, w: 6, h: 6, minW: 4, minH: 5 },
    'status-distribution': { x: 0, w: 6, h: 6, minW: 4, minH: 4 },
    'application-activity': { x: 0, w: 6, h: 6, minW: 4, minH: 4 }
  },
  md: {
    text: { x: 0, w: 6, h: 4, minW: 3, minH: 3 },
    'application-pipeline': { x: 0, w: 8, h: 11, minW: 4, minH: 7 },
    'application-snapshot': { x: 0, w: 4, h: 6, minW: 3, minH: 5 },
    'status-distribution': { x: 0, w: 4, h: 6, minW: 3, minH: 4 },
    'application-activity': { x: 0, w: 4, h: 6, minW: 3, minH: 4 }
  },
  sm: {
    text: { x: 0, w: 4, h: 4, minW: 2, minH: 3 },
    'application-pipeline': { x: 0, w: 4, h: 11, minW: 2, minH: 7 },
    'application-snapshot': { x: 0, w: 4, h: 6, minW: 2, minH: 5 },
    'status-distribution': { x: 0, w: 4, h: 6, minW: 2, minH: 4 },
    'application-activity': { x: 0, w: 4, h: 6, minW: 2, minH: 4 }
  },
  xs: {
    text: { x: 0, w: 1, h: 5, minW: 1, minH: 4 },
    'application-pipeline': { x: 0, w: 1, h: 12, minW: 1, minH: 8 },
    'application-snapshot': { x: 0, w: 1, h: 7, minW: 1, minH: 5 },
    'status-distribution': { x: 0, w: 1, h: 7, minW: 1, minH: 5 },
    'application-activity': { x: 0, w: 1, h: 7, minW: 1, minH: 5 }
  }
};

export const createDefaultDashboardLayouts = (
  widgets: DashboardWidgetInstance[] = DEFAULT_WIDGET_INSTANCES
): ResponsiveLayouts<DashboardBreakpoint> => Object.fromEntries(
  (Object.keys(DEFAULT_ITEMS) as DashboardBreakpoint[]).map((breakpoint) => [
    breakpoint,
    widgets.reduce<LayoutItem[]>((items, widget) => {
      const y = items.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
      items.push({ ...DEFAULT_ITEMS[breakpoint][widget.type], i: widget.id, y });
      return items;
    }, [])
  ])
) as ResponsiveLayouts<DashboardBreakpoint>;

const isLayoutItem = (value: unknown): value is LayoutItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LayoutItem>;
  return typeof item.i === 'string'
    && [item.x, item.y, item.w, item.h].every((entry) => typeof entry === 'number' && Number.isFinite(entry));
};

export const reconcileDashboardLayouts = (
  candidate: unknown,
  widgets: DashboardWidgetInstance[]
): ResponsiveLayouts<DashboardBreakpoint> => {
  const source = candidate && typeof candidate === 'object'
    ? candidate as Partial<Record<DashboardBreakpoint, unknown>>
    : {};

  return Object.fromEntries(
    (Object.keys(DEFAULT_ITEMS) as DashboardBreakpoint[]).map((breakpoint) => {
      const existingItems = Array.isArray(source[breakpoint])
        ? source[breakpoint].filter(isLayoutItem)
        : [];
      const columnCount = DASHBOARD_COLUMNS[breakpoint];
      const widgetIds = widgets.map((widget) => widget.id);
      const activeItems = existingItems
        .filter((item) => widgetIds.includes(item.i))
        .map((item) => {
          const widget = widgets.find((entry) => entry.id === item.i);
          const defaults = DEFAULT_ITEMS[breakpoint][widget?.type ?? 'text'];
          const minWidth = Math.min(item.minW ?? defaults.minW ?? 1, columnCount);
          const width = Math.max(minWidth, Math.min(item.w, columnCount));
          return {
            ...item,
            h: Math.max(item.minH ?? defaults.minH ?? 1, item.h),
            minH: defaults.minH,
            minW: defaults.minW,
            w: width,
            x: Math.max(0, Math.min(item.x, columnCount - width))
          };
        });
      let nextRow = activeItems.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
      const missingItems = widgets
        .filter((widget) => !activeItems.some((item) => item.i === widget.id))
        .map((widget) => {
          const item = { ...DEFAULT_ITEMS[breakpoint][widget.type], i: widget.id, y: nextRow };
          nextRow += item.h;
          return item;
        });

      return [breakpoint, [...activeItems, ...missingItems]];
    })
  ) as ResponsiveLayouts<DashboardBreakpoint>;
};

export const isDashboardWidgetType = (value: unknown): value is DashboardWidgetType => (
  DASHBOARD_WIDGETS.some((widget) => widget.id === value)
);

export const isDashboardWidgetInstance = (value: unknown): value is DashboardWidgetInstance => {
  if (!value || typeof value !== 'object') return false;
  const widget = value as Partial<DashboardWidgetInstance>;
  return typeof widget.id === 'string'
    && isDashboardWidgetType(widget.type)
    && (widget.content === undefined || typeof widget.content === 'string');
};
