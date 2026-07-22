import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResponsiveLayouts } from 'react-grid-layout';
import { Check, LayoutGrid, Pencil, RotateCcw } from 'lucide-react';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import WidgetFrame from '../components/dashboard/WidgetFrame';
import WidgetLibraryModal from '../components/dashboard/WidgetLibraryModal';
import ApplicationPipelineWidget from '../components/dashboard/widgets/ApplicationPipelineWidget';
import {
  ApplicationActivityWidget,
  ApplicationSnapshotWidget,
  StatusDistributionWidget
} from '../components/dashboard/widgets/ApplicationAnalyticsWidgets';
import TextWidget from '../components/dashboard/widgets/TextWidget';
import {
  createDefaultDashboardLayouts,
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGET_INSTANCES,
  isDashboardWidgetInstance,
  reconcileDashboardLayouts
} from '../components/dashboard/widgetLibrary';
import type {
  DashboardBreakpoint,
  DashboardWidgetInstance,
  DashboardWidgetType
} from '../components/dashboard/widgetLibrary';
import {
  loadApplications,
  saveApplications
} from '../components/job-tracker/jobApplication';
import type {
  JobApplication,
  JobApplicationStatus
} from '../components/job-tracker/jobApplication';
import AddButton from '../components/ui/AddButton';
import './Dashboard.css';
import { createRichTextFromPlainText, normalizeRichText } from '../features/rich-text/richText';
import {
  LOCAL_DATA_KEYS,
  readLocalDocument,
  subscribeToLocalDocument,
  writeLocalDocument
} from '../features/storage/localDatabase';

type LocalDashboardDocument = {
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
  widgets: DashboardWidgetInstance[];
};

const copyDefaultWidgets = () => DEFAULT_WIDGET_INSTANCES.map((widget) => ({ ...widget }));

const normalizeWidgets = (value: unknown): DashboardWidgetInstance[] => {
  return Array.isArray(value)
    ? value.filter(isDashboardWidgetInstance).map((widget) => ({
      ...widget,
      content: widget.type === 'text' ? normalizeRichText(widget.content) : undefined
    }))
    : copyDefaultWidgets();
};

const normalizeLayouts = (
  value: unknown,
  widgets: DashboardWidgetInstance[]
): ResponsiveLayouts<DashboardBreakpoint> => {
  return reconcileDashboardLayouts(value, widgets);
};

const createWidget = (type: DashboardWidgetType): DashboardWidgetInstance => ({
  id: type === 'application-pipeline' ? type : `text-${crypto.randomUUID()}`,
  type,
  content: type === 'text' ? createRichTextFromPlainText('Enter text') : undefined
});

export default function Dashboard() {
  const [widgets, setWidgets] = useState<DashboardWidgetInstance[]>(copyDefaultWidgets);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false);
  const [isLocalDataLoaded, setIsLocalDataLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [layouts, setLayouts] = useState<ResponsiveLayouts<DashboardBreakpoint>>(
    () => createDefaultDashboardLayouts(widgets)
  );

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      readLocalDocument<LocalDashboardDocument>(LOCAL_DATA_KEYS.dashboard),
      loadApplications()
    ]).then(([dashboard, loadedApplications]) => {
      if (!isCurrent) return;
      const loadedWidgets = normalizeWidgets(dashboard?.widgets);
      setWidgets(loadedWidgets);
      setLayouts(normalizeLayouts(dashboard?.layouts, loadedWidgets));
      setApplications(loadedApplications);
    }).catch(() => {
      if (isCurrent) setStorageError('Dashboard data could not be loaded from this browser.');
    }).finally(() => {
      if (isCurrent) setIsLocalDataLoaded(true);
    });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!isLocalDataLoaded) return;
    void writeLocalDocument(LOCAL_DATA_KEYS.dashboard, { layouts, widgets } satisfies LocalDashboardDocument)
      .catch(() => setStorageError('Dashboard changes could not be saved in local browser storage.'));
  }, [isLocalDataLoaded, layouts, widgets]);

  useEffect(() => {
    const syncApplications = () => {
      void loadApplications()
        .then(setApplications)
        .catch(() => setStorageError('Application data could not be refreshed from local storage.'));
    };
    return subscribeToLocalDocument(LOCAL_DATA_KEYS.jobApplications, syncApplications);
  }, []);

  const updateApplicationStatus = useCallback((id: string, status: JobApplicationStatus) => {
    setApplications((current) => {
      const next = current.map((application) => (
        application.id === id ? { ...application, status } : application
      ));
      void saveApplications(next).catch(() => setStorageError('The application status could not be saved locally.'));
      return next;
    });
  }, []);

  const saveApplication = useCallback((application: JobApplication) => {
    setApplications((current) => {
      const exists = current.some((currentApplication) => currentApplication.id === application.id);
      const next = exists
        ? current.map((currentApplication) => currentApplication.id === application.id ? application : currentApplication)
        : [...current, application];
      void saveApplications(next).catch(() => setStorageError('The application could not be saved locally.'));
      return next;
    });
  }, []);

  const addWidget = (type: DashboardWidgetType) => {
    if (type === 'application-pipeline' && widgets.some((widget) => widget.type === type)) return;
    const nextWidgets = [...widgets, createWidget(type)];
    setIsEditing(true);
    setWidgets(nextWidgets);
    setLayouts((current) => reconcileDashboardLayouts(current, nextWidgets));
    setIsWidgetLibraryOpen(false);
  };

  const removeWidget = useCallback((id: string) => {
    setWidgets((current) => {
      const nextWidgets = current.filter((widget) => widget.id !== id);
      setLayouts((currentLayouts) => reconcileDashboardLayouts(currentLayouts, nextWidgets));
      return nextWidgets;
    });
  }, []);

  const updateWidgetContent = useCallback((id: string, content: string) => {
    setWidgets((current) => current.map((widget) => (
      widget.id === id ? { ...widget, content } : widget
    )));
  }, []);

  const resizeWidgetHeight = useCallback((id: string, amount: number) => {
    setLayouts((current) => Object.fromEntries(
      Object.entries(current).map(([breakpoint, layout]) => [
        breakpoint,
        layout?.map((item) => item.i === id
          ? { ...item, h: Math.max(item.minH ?? 3, Math.min(item.maxH ?? 18, item.h + amount)) }
          : item)
      ])
    ) as ResponsiveLayouts<DashboardBreakpoint>);
  }, []);

  const resetDashboard = () => {
    const defaultWidgets = copyDefaultWidgets();
    setWidgets(defaultWidgets);
    setLayouts(createDefaultDashboardLayouts(defaultWidgets));
  };

  const gridItems = useMemo(() => widgets.map((widget) => {
    const definition = DASHBOARD_WIDGETS.find((entry) => entry.id === widget.type);
    if (!definition) return null;

    return {
      id: widget.id,
      title: definition.title,
      content: (
        <WidgetFrame
          headingId={`dashboard-widget-${widget.id}`}
          isEditing={isEditing}
          onDecreaseHeight={() => resizeWidgetHeight(widget.id, -1)}
          onIncreaseHeight={() => resizeWidgetHeight(widget.id, 1)}
          onRemove={() => removeWidget(widget.id)}
          title={definition.title}
        >
          {widget.type === 'application-pipeline' ? (
            <ApplicationPipelineWidget
              applications={applications}
              onApplicationSave={saveApplication}
              onStatusChange={updateApplicationStatus}
            />
          ) : widget.type === 'application-snapshot' ? (
            <ApplicationSnapshotWidget applications={applications} />
          ) : widget.type === 'status-distribution' ? (
            <StatusDistributionWidget applications={applications} />
          ) : widget.type === 'application-activity' ? (
            <ApplicationActivityWidget applications={applications} />
          ) : (
            <TextWidget
              id={widget.id}
              isEditing={isEditing}
              onChange={(content) => updateWidgetContent(widget.id, content)}
              value={widget.content ?? ''}
            />
          )}
        </WidgetFrame>
      )
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null), [
    applications,
    isEditing,
    removeWidget,
    resizeWidgetHeight,
    saveApplication,
    updateApplicationStatus,
    updateWidgetContent,
    widgets
  ]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-toolbar">
        <div className="dashboard-heading">
          <h1>Dashboard</h1>
        </div>
        <div className="dashboard-toolbar-actions" aria-label="Dashboard controls">
          {isEditing ? (
            <>
              <button className="btn btn-secondary dashboard-reset-button" onClick={resetDashboard} type="button">
                <RotateCcw aria-hidden="true" size={18} />
                Reset
              </button>
              <AddButton className="dashboard-add-widget-button" onClick={() => setIsWidgetLibraryOpen(true)}>
                Add Widget
              </AddButton>
              <button className="btn btn-primary dashboard-edit-button" onClick={() => setIsEditing(false)} type="button">
                <Check aria-hidden="true" size={18} />
                Done
              </button>
            </>
          ) : (
            <>
              <AddButton className="dashboard-add-widget-button" onClick={() => setIsWidgetLibraryOpen(true)}>
                Add Widget
              </AddButton>
              <button className="btn btn-primary dashboard-edit-button" onClick={() => setIsEditing(true)} type="button">
                <Pencil aria-hidden="true" size={18} />
                Edit
              </button>
            </>
          )}
        </div>
      </header>

      {storageError ? <p className="field-error" role="alert">{storageError}</p> : null}

      {gridItems.length ? (
        <DashboardGrid
          isEditing={isEditing}
          items={gridItems}
          layouts={layouts}
          onLayoutsChange={setLayouts}
        />
      ) : (
        <section className="dashboard-empty-state" aria-labelledby="dashboard-empty-title">
          <LayoutGrid aria-hidden="true" size={42} />
          <h2 className="section-title" id="dashboard-empty-title">No widgets added</h2>
          {isEditing ? <AddButton onClick={() => setIsWidgetLibraryOpen(true)}>Add Widget</AddButton> : null}
        </section>
      )}

      <WidgetLibraryModal
        activeWidgets={widgets}
        isOpen={isWidgetLibraryOpen}
        onAdd={addWidget}
        onClose={() => setIsWidgetLibraryOpen(false)}
      />
    </div>
  );
}
