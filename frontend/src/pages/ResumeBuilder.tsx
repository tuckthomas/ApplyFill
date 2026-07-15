import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import Checkbox from '../components/ui/Checkbox';

export default function ResumeBuilder() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h2 className="page-title">Resume Builder</h2>
          <p className="page-copy">Tailor a resume to a target role and preview the finished document.</p>
        </div>
        <span className="status-pill">Draft</span>
      </header>

      <div className="builder-grid">
        <section className="surface-panel page-stack" style={{ padding: '24px' }} aria-labelledby="resume-details-title">
          <div>
            <h3 id="resume-details-title" className="section-title">Resume Details</h3>
            <p className="section-copy">Set the target and choose which source content to include.</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="resume-title">Resume Title</label>
            <input id="resume-title" type="text" className="form-input" placeholder="e.g. Senior Software Engineer - Google" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="target-job-url">Target Job URL (Optional)</label>
            <input id="target-job-url" type="url" className="form-input" placeholder="https://..." />
          </div>

          <div className="field-card">
            <h4 className="section-title">Select Content</h4>
            <p className="section-copy">Choose which profile sections to include.</p>
            <hr className="subtle-divider" />
            <Checkbox defaultChecked label="Include summary" />
            <Checkbox defaultChecked label="Include all experience" />
            <Checkbox defaultChecked label="Include all projects" />
            <Checkbox defaultChecked label="Include all education" />
          </div>

          <div className="toolbar-row" style={{ marginTop: 'auto' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/')} type="button">Cancel</button>
            <button className="btn btn-primary" type="button" disabled>Generate PDF</button>
          </div>
        </section>

        <section className="surface-panel preview-panel" aria-labelledby="preview-title">
          <div className="empty-state">
            <FileText size={52} strokeWidth={1.4} aria-hidden="true" />
            <h3 id="preview-title" className="section-title">Live PDF Preview</h3>
            <p className="section-copy" style={{ maxWidth: '360px' }}>
              Your tailored resume will appear here as you configure content and templates.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
