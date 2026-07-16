import type { ReactNode } from 'react';
import { Responsive, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLUMNS
} from './widgetLibrary';
import type { DashboardBreakpoint } from './widgetLibrary';

type DashboardGridItem = {
  content: ReactNode;
  id: string;
  title: string;
};

type DashboardGridProps = {
  items: DashboardGridItem[];
  isEditing: boolean;
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
  onLayoutsChange: (layouts: ResponsiveLayouts<DashboardBreakpoint>) => void;
};

export default function DashboardGrid({ items, isEditing, layouts, onLayoutsChange }: DashboardGridProps) {
  const { containerRef, mounted, width } = useContainerWidth();
  const currentBreakpoint = Object.entries(DASHBOARD_BREAKPOINTS)
    .sort((left, right) => right[1] - left[1])
    .find(([, minimumWidth]) => width >= minimumWidth)?.[0] as DashboardBreakpoint | undefined;
  const breakpoint = currentBreakpoint ?? 'xs';
  const margin: [number, number] = breakpoint === 'xs' ? [0, 12] : [16, 16];

  return (
    <section
      aria-label="Dashboard widgets"
      className={`dashboard-grid-shell${isEditing ? ' is-editing' : ''}`}
      data-breakpoint={breakpoint}
      ref={containerRef}
    >
      {mounted ? (
        <Responsive<DashboardBreakpoint>
          breakpoints={DASHBOARD_BREAKPOINTS}
          className="dashboard-grid"
          cols={DASHBOARD_COLUMNS}
          compactor={verticalCompactor}
          containerPadding={[0, 0]}
          dragConfig={{
            bounded: true,
            enabled: isEditing,
            handle: '.dashboard-widget-drag-handle',
            threshold: 5
          }}
          layouts={layouts}
          margin={margin}
          onLayoutChange={(_layout, nextLayouts) => onLayoutsChange(nextLayouts)}
          resizeConfig={{
            enabled: isEditing,
            handles: ['se']
          }}
          rowHeight={44}
          width={width}
        >
          {items.map((item) => (
            <div className="dashboard-grid-item" key={item.id}>
              {item.content}
            </div>
          ))}
        </Responsive>
      ) : null}
    </section>
  );
}
