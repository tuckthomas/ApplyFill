import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

export default function Resumes() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Resume Versions</h2>
          <p className="page-copy">Manage targeted resumes, export status, and document versions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/resumes/builder')} type="button">
          <Plus size={18} />
          New Resume
        </button>
      </header>

      <section className="surface-panel" style={{ padding: '24px' }} aria-labelledby="resume-versions-title">
        <div className="toolbar-row">
          <div>
            <h3 id="resume-versions-title" className="section-title">Current Versions</h3>
            <p className="section-copy">No generated resume versions are saved yet.</p>
          </div>
          <span className="status-pill">0 drafts</span>
        </div>

        <div className="empty-state">
          <FileText size={52} strokeWidth={1.4} aria-hidden="true" />
          <h3 className="section-title">Start a targeted resume</h3>
          <p className="section-copy" style={{ maxWidth: '420px' }}>
            Saved drafts, layout analysis, PDF exports, and DOCX compatibility exports will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
