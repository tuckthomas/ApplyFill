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
import { BriefcaseBusiness, CalendarDays, ExternalLink, GripVertical, MapPin, Plus } from 'lucide-react';
import type { StylesConfig } from 'react-select';
import AppSelect from '../../ui/AppSelect';
import JobApplicationModal from '../../job-tracker/JobApplicationModal';
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
  onApplicationSave: (application: JobApplication) => void;
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
  onOpen: () => void;
  onStatusChange: (status: JobApplicationStatus) => void;
};

function PipelineCard({ application, onOpen, onStatusChange }: PipelineCardProps) {
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
        <button
          aria-label={`Open ${application.jobTitle} at ${application.companyName}`}
          className="icon-button pipeline-card-open-button"
          data-tooltip="Open application"
          onClick={onOpen}
          onKeyDown={stopDragStart}
          onMouseDown={stopDragStart}
          onPointerDown={stopDragStart}
          onTouchStart={stopDragStart}
          type="button"
        >
          <ExternalLink aria-hidden="true" size={16} />
        </button>
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
  onOpenApplication: (application: JobApplication) => void;
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
  status: JobApplicationStatus;
};

function PipelineColumn({ applications, onOpenApplication, onStatusChange, status }: PipelineColumnProps) {
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
            onOpen={() => onOpenApplication(application)}
            onStatusChange={(nextStatus) => onStatusChange(application.id, nextStatus)}
          />
        )) : <p className="pipeline-column-empty">No applications</p>}
      </div>
    </section>
  );
}

export default function ApplicationPipelineWidget({
  applications,
  onApplicationSave,
  onStatusChange
}: ApplicationPipelineWidgetProps) {
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | undefined>();
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

  const openApplicationModal = (application?: JobApplication) => {
    setSelectedApplication(application);
    setIsApplicationModalOpen(true);
  };

  return (
    <div className="application-pipeline-widget">
      <div className="pipeline-toolbar">
        <div className="pipeline-total">
          <BriefcaseBusiness aria-hidden="true" size={18} />
          <span>{applications.length} tracked {applications.length === 1 ? 'application' : 'applications'}</span>
        </div>
        <button className="btn btn-primary pipeline-add-button" onClick={() => openApplicationModal()} type="button">
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
        <div className="pipeline-board-scroll" role="region" aria-label="Job application Kanban board" tabIndex={0}>
          <div className="pipeline-board">
            {STATUS_OPTIONS.map(({ value }) => (
              <PipelineColumn
                applications={applicationsByStatus[value]}
                key={value}
                onOpenApplication={openApplicationModal}
                onStatusChange={onStatusChange}
                status={value}
              />
            ))}
          </div>
        </div>
        {createPortal(
          <DragOverlay dropAnimation={null} zIndex={1400}>
            {activeApplication ? <PipelineCardDragPreview application={activeApplication} /> : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
      {isApplicationModalOpen ? (
        <JobApplicationModal
          application={selectedApplication}
          key={selectedApplication?.id ?? 'new'}
          onClose={() => setIsApplicationModalOpen(false)}
          onSave={onApplicationSave}
        />
      ) : null}
    </div>
  );
}
