import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, UserCircle, Sun, Moon, ChevronLeft, ChevronRight, Menu, BriefcaseBusiness } from 'lucide-react';
import { ApplyFillLogo } from '../brand/ApplyFillLogo';
import './MainLayout.css';

export function MainLayout() {
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const syncSidebar = () => {
      if (mobileQuery.matches) {
        setIsSidebarExpanded(false);
      }
    };

    syncSidebar();
    mobileQuery.addEventListener('change', syncSidebar);
    return () => mobileQuery.removeEventListener('change', syncSidebar);
  }, []);

  const navigation = useMemo(() => [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Profile', href: '/profile', icon: UserCircle },
    { name: 'Resumes', href: '/resumes', icon: FileText },
    { name: 'Job Tracker', href: '/job-tracker', icon: BriefcaseBusiness },
    { name: 'Settings', href: '/settings', icon: Settings },
  ], []);

  return (
    <div className={`layout-container ${isSidebarExpanded ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <button
            className="icon-button" 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            type="button"
            aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            data-tooltip={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                data-tooltip={!isSidebarExpanded ? item.name : undefined}
                onClick={() => {
                  if (window.matchMedia('(max-width: 900px)').matches) {
                    setIsSidebarExpanded(false);
                  }
                }}
              >
                <item.icon className="nav-icon" size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              type="button"
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <Link className="header-brand" to="/" aria-label="Go to ApplyFill dashboard">
              <ApplyFillLogo />
            </Link>
          </div>
          <div className="header-actions">
            <button 
              className="icon-button" 
              onClick={() => setIsDarkMode(!isDarkMode)}
              type="button"
              aria-label={isDarkMode ? 'Use light theme' : 'Use dark theme'}
              data-tooltip={isDarkMode ? 'Use light theme' : 'Use dark theme'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link
              className={`icon-button header-profile-action ${location.pathname.startsWith('/profile') ? 'active' : ''}`}
              to="/profile"
              aria-label="Open profile"
              aria-current={location.pathname.startsWith('/profile') ? 'page' : undefined}
              data-tooltip="Profile"
            >
              <UserCircle size={22} />
            </Link>
          </div>
        </header>

        <main className="content-area animate-fade-in">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
