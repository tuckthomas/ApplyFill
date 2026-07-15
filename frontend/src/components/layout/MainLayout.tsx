import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, UserCircle, Sun, Moon, ChevronDown, ChevronLeft, ChevronRight, Menu, BriefcaseBusiness, PlusCircle } from 'lucide-react';
import { ApplyFillLogo } from '../brand/ApplyFillLogo';
import './MainLayout.css';

export function MainLayout() {
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [isJobTrackerExpanded, setIsJobTrackerExpanded] = useState(() => location.pathname.startsWith('/job-tracker'));

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
    {
      name: 'Applications',
      href: '/job-tracker',
      icon: BriefcaseBusiness,
      children: [
        { name: 'Job Tracker', href: '/job-tracker', icon: BriefcaseBusiness },
        { name: 'Add Application', href: '/job-tracker/new', icon: PlusCircle }
      ]
    },
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
            const closeMobileSidebar = () => {
              if (window.matchMedia('(max-width: 900px)').matches) {
                setIsSidebarExpanded(false);
              }
            };

          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <div className="nav-item-group" key={item.name}>
                <div className="nav-parent-item">
                  <Link to={item.href} className={`nav-item ${isActive ? 'active' : ''}`} aria-current={location.pathname === item.href ? 'page' : undefined} data-tooltip={!isSidebarExpanded ? item.name : undefined} onClick={closeMobileSidebar}>
                    <item.icon className="nav-icon" size={20} />
                    <span>{item.name}</span>
                  </Link>
                  {item.children && isSidebarExpanded && (
                    <button className="nav-submenu-toggle" type="button" onClick={() => setIsJobTrackerExpanded((current) => !current)} aria-label={`${isJobTrackerExpanded ? 'Collapse' : 'Expand'} ${item.name} menu`} aria-controls="applications-submenu" aria-expanded={isJobTrackerExpanded} data-tooltip={`${isJobTrackerExpanded ? 'Collapse' : 'Expand'} ${item.name}`}>
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {item.children && isSidebarExpanded && isJobTrackerExpanded && (
                  <div id="applications-submenu" className="nav-submenu">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.href;
                      return (
                        <Link key={child.name} to={child.href} className={`nav-item nav-submenu-item${isChildActive ? ' active' : ''}`} aria-current={isChildActive ? 'page' : undefined} onClick={closeMobileSidebar}>
                          <child.icon className="nav-icon" size={18} />
                          <span>{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
