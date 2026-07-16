import { useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { BriefcaseBusiness, CalendarDays, GripVertical, MapPin, Plus } from 'lucide-react';
import type { StylesConfig } from 'react-select';
import { useNavigate } from 'react-router-dom';
import AppSelect from '../../ui/AppSelect';
import { formatExactDateForDisplay } from '../../ui/datePickerUtils';
import { selectStyles } from '../../../constants/location';
import { useDateFormatPreference } from '../../../features/preferences/dateFormatPreference';
import { STATUS_OPTIONS, getStatusOption } from '../../job-tracker/jobApplication';
import type {
  JobApplication,
  JobApplicationStatus,
  StatusOption
} from '../../job-tracker/jobApplication';

type ApplicationPipelineWidgetProps = {
  applications: JobApplication[];
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
};

const compactSelectStyles: StylesConfig<StatusOption, false> = {
  control: (base, state) => ({
    ...selectStyles.control(base, state),
    height: '40px',
    minHeight: '40px'
  }),
  valueContainer: (base) => ({ ...base, height: '38px', padding: '0 10px' }),
  indicatorsContainer: (base) => ({ ...base, height: '38px' }),
  dropdownIndicator: (base) => ({ ...base, padding: '0 8px' }),
  indicatorSeparator: (base) => ({ ...base, marginBottom: '8px', marginTop: '8px' }),
  singleValue: (base) => ({ ...base, color: 'var(--text-main)', fontSize: '0.88rem' }),
  menu: selectStyles.menu,
  menuList: selectStyles.menuList,
  option: selectStyles.option
};

const statusClassName = (status: JobApplicationStatus) => status.toLowerCase().replaceAll(' ', '-');
const stopDragStart = (event: SyntheticEvent) => event.stopPropagation();

type PipelineCardProps = {
  application: JobApplication;
  onStatusChange: (status: JobApplicationStatus) => void;
};

function PipelineCard({ application, onStatusChange }: PipelineCardProps) {
  const { dateFormat } = useDateFormatPreference();
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: application.id,
    data: { status: application.status }
  });

  return (
    <article
      {...attributes}
      {...listeners}
      aria-label={`Move ${application.jobTitle} at ${application.companyName}`}
      className={`pipeline-card ${isDragging ? 'is-dragging' : ''}`}
      ref={setNodeRef}
    >
      <div className="pipeline-card-heading">
        <span className="pipeline-card-drag-handle" aria-hidden="true">
          <GripVertical aria-hidden="true" size={18} />
        </span>
        <div className="pipeline-card-title">
          <strong>{application.jobTitle}</strong>
          <span>{application.companyName}</span>
        </div>
      </div>
      <div className="pipeline-card-meta">
        <span><MapPin aria-hidden="true" size={14} />{application.location || 'Location not recorded'}</span>
        <span><CalendarDays aria-hidden="true" size={14} />{application.appliedDate ? formatExactDateForDisplay(application.appliedDate, dateFormat) : 'Date not recorded'}</span>
      </div>
      <label className="sr-only" htmlFor={`pipeline-status-${application.id}`}>
        Status for {application.jobTitle} at {application.companyName}
      </label>
      <div
        className="pipeline-card-action"
        onKeyDown={stopDragStart}
        onMouseDown={stopDragStart}
        onPointerDown={stopDragStart}
        onTouchStart={stopDragStart}
      >
        <AppSelect<StatusOption>
          inputId={`pipeline-status-${application.id}`}
          isSearchable={false}
          onChange={(option) => {
            if (option) onStatusChange(option.value);
          }}
          options={STATUS_OPTIONS}
          styles={compactSelectStyles}
          value={getStatusOption(application.status)}
        />
      </div>
    </article>
  );
}

function PipelineCardDragPreview({ application }: { application: JobApplication }) {
  const { dateFormat } = useDateFormatPreference();

  return (
    <article
      aria-hidden="true"
      className="pipeline-card pipeline-card-drag-preview"
    >
      <div className="pipeline-card-heading">
        <span className="pipeline-card-drag-handle pipeline-card-preview-handle">
          <GripVertical aria-hidden="true" size={18} />
        </span>
        <div className="pipeline-card-title pipeline-card-preview-title">
          <strong>{application.jobTitle}</strong>
          <span>{application.companyName}</span>
        </div>
      </div>
      <div className="pipeline-card-meta">
        <span><MapPin aria-hidden="true" size={14} />{application.location || 'Location not recorded'}</span>
        <span><CalendarDays aria-hidden="true" size={14} />{application.appliedDate ? formatExactDateForDisplay(application.appliedDate, dateFormat) : 'Date not recorded'}</span>
      </div>
      <div className="pipeline-card-preview-status">{application.status}</div>
    </article>
  );
}

type PipelineColumnProps = {
  applications: JobApplication[];
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
  status: JobApplicationStatus;
};

function PipelineColumn({ applications, onStatusChange, status }: PipelineColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <section
      aria-labelledby={`pipeline-column-${statusClassName(status)}`}
      className={`pipeline-column ${isOver ? 'is-over' : ''}`}
      data-status={statusClassName(status)}
      ref={setNodeRef}
    >
      <header className="pipeline-column-header">
        <span className="pipeline-status-dot" aria-hidden="true" />
        <h4 id={`pipeline-column-${statusClassName(status)}`}>{status}</h4>
        <span className="pipeline-column-count" aria-label={`${applications.length} applications`}>
          {applications.length}
        </span>
      </header>
      <div className="pipeline-column-body">
        {applications.length ? applications.map((application) => (
          <PipelineCard
            application={application}
            key={application.id}
            onStatusChange={(nextStatus) => onStatusChange(application.id, nextStatus)}
          />
        )) : <p className="pipeline-column-empty">No applications</p>}
      </div>
    </section>
  );
}

export default function ApplicationPipelineWidget({
  applications,
  onStatusChange
}: ApplicationPipelineWidgetProps) {
  const navigate = useNavigate();
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );
  const applicationsByStatus = useMemo(() => Object.fromEntries(
    STATUS_OPTIONS.map(({ value }) => [
      value,
      applications
        .filter((application) => application.status === value)
        .sort((left, right) => right.appliedDate.localeCompare(left.appliedDate))
    ])
  ) as Record<JobApplicationStatus, JobApplication[]>, [applications]);
  const activeApplication = activeApplicationId
    ? applications.find((application) => application.id === activeApplicationId) ?? null
    : null;

  const detectColumnCollision: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length ? pointerCollisions : closestCenter(args);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveApplicationId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveApplicationId(null);
    if (!over) return;
    const nextStatus = over.id as JobApplicationStatus;
    if (!STATUS_OPTIONS.some((option) => option.value === nextStatus)) return;
    const application = applications.find((item) => item.id === active.id);
    if (application && application.status !== nextStatus) onStatusChange(application.id, nextStatus);
  };

  return (
    <div className="application-pipeline-widget">
      <div className="pipeline-toolbar">
        <div className="pipeline-total">
          <BriefcaseBusiness aria-hidden="true" size={18} />
          <span>{applications.length} tracked {applications.length === 1 ? 'application' : 'applications'}</span>
        </div>
        <button className="btn btn-primary pipeline-add-button" onClick={() => navigate('/job-tracker/new')} type="button">
          <Plus aria-hidden="true" size={18} />
          Add Application
        </button>
      </div>
      <DndContext
        collisionDetection={detectColumnCollision}
        onDragCancel={() => setActiveApplicationId(null)}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="pipeline-board" role="region" aria-label="Job application Kanban board" tabIndex={0}>
          {STATUS_OPTIONS.map(({ value }) => (
            <PipelineColumn
              applications={applicationsByStatus[value]}
              key={value}
              onStatusChange={onStatusChange}
              status={value}
            />
          ))}
        </div>
        {createPortal(
          <DragOverlay dropAnimation={null} zIndex={1400}>
            {activeApplication ? <PipelineCardDragPreview application={activeApplication} /> : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
