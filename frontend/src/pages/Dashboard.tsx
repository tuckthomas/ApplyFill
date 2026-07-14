import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="page-stack">
      <section className="surface-panel" style={{ padding: '32px' }} aria-labelledby="dashboard-title">
        <h2 id="dashboard-title" className="page-title">Welcome back, Developer</h2>
        <p className="page-copy">
          Create a new tailored resume or update your core profile information.
        </p>
      </section>

      <section className="responsive-grid" aria-label="Primary workflows">
        <article className="surface-panel page-stack" style={{ padding: '24px' }}>
          <h3 className="section-title">Core Profile</h3>
          <p className="section-copy" style={{ flex: 1 }}>
            Manage your work history, skills, and education to quickly build targeted resumes.
          </p>
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/profile')}>Edit Profile</button>
        </article>

        <article className="surface-panel page-stack" style={{ padding: '24px' }}>
          <h3 className="section-title">Recent Resumes</h3>
          <p className="section-copy" style={{ flex: 1 }}>
            You have not created any resumes yet. Start with one tailored to a specific role.
          </p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/resumes/builder')}>Create Resume</button>
        </article>
      </section>
    </div>
  );
}
