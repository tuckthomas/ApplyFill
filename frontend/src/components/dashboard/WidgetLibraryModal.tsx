import { BarChart3, ChartPie, Columns3, LayoutDashboard, Plus, Type } from 'lucide-react';
import FormModal from '../ui/FormModal';
import { DASHBOARD_WIDGETS } from './widgetLibrary';
import type { DashboardWidgetInstance, DashboardWidgetType } from './widgetLibrary';

type WidgetLibraryModalProps = {
  activeWidgets: DashboardWidgetInstance[];
  isOpen: boolean;
  onAdd: (type: DashboardWidgetType) => void;
  onClose: () => void;
};

export default function WidgetLibraryModal({
  activeWidgets,
  isOpen,
  onAdd,
  onClose
}: WidgetLibraryModalProps) {
  const widgetIcon = (id: DashboardWidgetType) => {
    if (id === 'text') return <Type size={24} />;
    if (id === 'application-pipeline') return <Columns3 size={24} />;
    if (id === 'application-snapshot') return <LayoutDashboard size={24} />;
    if (id === 'status-distribution') return <ChartPie size={24} />;
    return <BarChart3 size={24} />;
  };

  return (
    <FormModal
      className="widget-library-dialog"
      closeLabel="Close widget library"
      description="Choose a widget for your dashboard."
      isOpen={isOpen}
      onClose={onClose}
      title="Widget Library"
    >
      <div className="widget-library-list">
        {DASHBOARD_WIDGETS.map((widget) => {
          const isAdded = !widget.allowMultiple && activeWidgets.some((instance) => instance.type === widget.id);
          return (
            <article className="widget-library-item" key={widget.id}>
              <div className="widget-library-icon" aria-hidden="true">
                {widgetIcon(widget.id)}
              </div>
              <div className="widget-library-copy">
                <h4>{widget.title}</h4>
                <p>{widget.description}</p>
              </div>
              <button
                className="btn btn-primary widget-library-add-button"
                disabled={isAdded}
                onClick={() => onAdd(widget.id)}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
                {isAdded ? 'Added' : 'Add Widget'}
              </button>
            </article>
          );
        })}
      </div>
    </FormModal>
  );
}
