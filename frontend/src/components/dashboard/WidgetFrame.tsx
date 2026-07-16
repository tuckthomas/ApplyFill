import type { ReactNode } from 'react';
import { Grip, Maximize2, Minimize2, Trash2 } from 'lucide-react';

type WidgetFrameProps = {
  children: ReactNode;
  headingId: string;
  isEditing: boolean;
  onDecreaseHeight: () => void;
  onIncreaseHeight: () => void;
  onRemove: () => void;
  title: string;
};

export default function WidgetFrame({
  children,
  headingId,
  isEditing,
  onDecreaseHeight,
  onIncreaseHeight,
  onRemove,
  title
}: WidgetFrameProps) {
  return (
    <article
      aria-label={isEditing ? undefined : title}
      aria-labelledby={isEditing ? headingId : undefined}
      className={`dashboard-widget${isEditing ? ' is-editing' : ''}`}
    >
      {isEditing ? <header className="dashboard-widget-header">
        <div className="dashboard-widget-title-row">
          <button
            aria-label={`Move ${title} widget`}
            className="icon-button dashboard-widget-drag-handle"
            data-tooltip="Move widget"
            type="button"
          >
            <Grip aria-hidden="true" size={19} />
          </button>
          <h3 className="section-title" id={headingId}>{title}</h3>
        </div>
        <div className="dashboard-widget-actions">
          <button className="icon-button" data-tooltip="Decrease height" onClick={onDecreaseHeight} type="button" aria-label={`Decrease ${title} height`}>
            <Minimize2 aria-hidden="true" size={18} />
          </button>
          <button className="icon-button" data-tooltip="Increase height" onClick={onIncreaseHeight} type="button" aria-label={`Increase ${title} height`}>
            <Maximize2 aria-hidden="true" size={18} />
          </button>
          <button className="icon-button icon-button-danger" data-tooltip="Remove widget" onClick={onRemove} type="button" aria-label={`Remove ${title}`}>
            <Trash2 aria-hidden="true" size={18} />
          </button>
        </div>
      </header> : null}
      <div className="dashboard-widget-body">
        {children}
      </div>
    </article>
  );
}
