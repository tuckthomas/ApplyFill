import { useEffect, useMemo, useState } from 'react';
import { Edit3, FileText, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AddButton from '../components/ui/AddButton';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import type { DataTableColumn } from '../components/ui/DataTable';
import { deleteResumeDraft, loadResumeCollection } from '../features/resume/resumeDocument';
import type { LocalResumeDraft } from '../features/resume/resumeDocument';
import { LOCAL_DATA_KEYS, subscribeToLocalDocument } from '../features/storage/localDatabase';

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function Resumes() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<LocalResumeDraft[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const load = () => loadResumeCollection()
      .then((collection) => { if (isCurrent) setResumes(collection.resumes); })
      .catch(() => { if (isCurrent) setMessage('Local resume drafts could not be loaded.'); });
    void load();
    const unsubscribe = subscribeToLocalDocument(LOCAL_DATA_KEYS.resumes, () => { void load(); });
    return () => { isCurrent = false; unsubscribe(); };
  }, []);

  const removeResume = async (resume: LocalResumeDraft) => {
    if (!window.confirm(`Delete “${resume.title}” from this browser? This cannot be undone.`)) return;
    try {
      await deleteResumeDraft(resume.id);
      setMessage('Local resume draft deleted.');
    } catch {
      setMessage('The local resume draft could not be deleted.');
    }
  };

  const columns = useMemo<Array<DataTableColumn<LocalResumeDraft>>>(() => [
    {
      cell: (resume) => <strong>{resume.title}</strong>,
      header: 'Resume', id: 'title', searchValue: (resume) => resume.title, sortValue: (resume) => resume.title
    },
    {
      cell: (resume) => resume.targetRole || 'Not specified',
      header: 'Target Role', id: 'role', searchValue: (resume) => resume.targetRole, sortValue: (resume) => resume.targetRole
    },
    {
      cell: (resume) => formatUpdatedAt(resume.updatedAtUtc),
      header: 'Updated', id: 'updated', hideOnMobile: true, sortValue: (resume) => new Date(resume.updatedAtUtc)
    },
    {
      cell: (resume) => (
        <div className="data-table-action-group">
          <button className="icon-button" onClick={() => navigate(`/resumes/builder/${resume.id}`)} type="button" aria-label={`Edit ${resume.title}`} data-tooltip="Edit resume"><Edit3 size={17} aria-hidden="true" /></button>
          <button className="icon-button danger-icon-button" onClick={() => void removeResume(resume)} type="button" aria-label={`Delete ${resume.title}`} data-tooltip="Delete resume"><Trash2 size={17} aria-hidden="true" /></button>
        </div>
      ),
      header: 'Actions', id: 'actions'
    }
  ], [navigate]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Resume Builder</h2>
          <p className="page-copy">Manage targeted resumes and generate private, browser-local exports.</p>
        </div>
        <AddButton onClick={() => navigate('/resumes/builder')}>New Resume</AddButton>
      </header>
      {message ? <p className="profile-data-message" role="status">{message}</p> : null}
      <section className="surface-panel tracker-list-panel">
        <DataTable
          caption="Local resume drafts"
          columns={columns}
          description="Draft definitions are stored in IndexedDB. Generated PDF and DOCX files are created only when you download them."
          emptyContent={(
            <div className="empty-state data-table-empty-state">
              <FileText size={52} strokeWidth={1.4} aria-hidden="true" />
              <h3 className="section-title">Start a targeted resume</h3>
              <p className="section-copy">Choose profile content, tailor a summary, preview the PDF, and download local PDF, DOCX, or JSON files.</p>
              <Button onClick={() => navigate('/resumes/builder')} variant="primary">Create Resume</Button>
            </div>
          )}
          getRowId={(resume) => resume.id}
          initialSort={{ columnId: 'updated', direction: 'desc' }}
          rows={resumes}
          searchPlaceholder="Search resumes"
          title="Local Resume Drafts"
        />
      </section>
    </div>
  );
}
