import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import AddButton from '../components/ui/AddButton';

export default function Resumes() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Resume Versions</h2>
          <p className="page-copy">Manage targeted resumes, export status, and document versions.</p>
        </div>
        <AddButton onClick={() => navigate('/resumes/builder')}>New Resume</AddButton>
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
