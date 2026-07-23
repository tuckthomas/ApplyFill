import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, UserCircle, Sun, Moon, ChevronLeft, ChevronRight, Menu, BriefcaseBusiness, PlusCircle, Wand2, X } from 'lucide-react';
import { ApplyFillLogo } from '../brand/ApplyFillLogo';
import './MainLayout.css';

export function MainLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [expandedNavGroups, setExpandedNavGroups] = useState<Set<string>>(() => {
    if (location.pathname.startsWith('/job-tracker')) return new Set(['applications']);
    if (location.pathname.startsWith('/job-profile')) return new Set(['job-profile']);
    return new Set();
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
    {
      name: 'Job Profile',
      href: '/job-profile',
      icon: UserCircle,
      groupId: 'job-profile',
      children: [
        { name: 'Job Profile', href: '/job-profile', icon: UserCircle },
        { name: 'Job Profile Builder', href: '/job-profile/builder', icon: Wand2 }
      ]
    },
    { name: 'Resume Builder', href: '/resumes', icon: FileText },
    {
      name: 'Applications',
      href: '/job-tracker',
      icon: BriefcaseBusiness,
      groupId: 'applications',
      children: [
        { name: 'Job Tracker', href: '/job-tracker', icon: BriefcaseBusiness },
        { name: 'Add Application', href: '/job-tracker/new', icon: PlusCircle }
      ]
    },
    { name: 'Settings', href: '/settings', icon: Settings },
  ], []);

  useEffect(() => {
    const activeGroup = navigation.find((item) => (
      item.groupId && item.href !== '/' && location.pathname.startsWith(item.href)
    ));

    if (activeGroup?.groupId) {
      setExpandedNavGroups((current) => {
        if (current.has(activeGroup.groupId)) return current;
        return new Set([...current, activeGroup.groupId]);
      });
    }
  }, [location.pathname, navigation]);

  const toggleNavGroup = (groupId: string) => {
    setExpandedNavGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className={`layout-container ${isSidebarExpanded ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`} aria-label="Primary navigation">
        <div className="sidebar-header">
          <Link className="sidebar-mobile-brand" to="/" aria-label="Go to ApplyFill dashboard">
            <ApplyFillLogo />
          </Link>
          <button
            className="icon-button" 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            type="button"
            aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            data-tooltip={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="sidebar-desktop-toggle-icon" aria-hidden="true">
              {isSidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </span>
            <X className="sidebar-mobile-close-icon" size={22} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            const isGroupExpanded = item.groupId ? expandedNavGroups.has(item.groupId) : false;
            const closeMobileSidebar = () => {
              if (window.matchMedia('(max-width: 900px)').matches) {
                setIsSidebarExpanded(false);
              }
            };

            return (
              <div className="nav-item-group" key={item.name}>
                {item.children && item.groupId && !isSidebarExpanded ? (
                  <Link
                    to={item.children[0]?.href ?? item.href}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    aria-label={item.name}
                    aria-current={location.pathname === (item.children[0]?.href ?? item.href) ? 'page' : undefined}
                    data-tooltip={item.name}
                    onClick={closeMobileSidebar}
                  >
                    <item.icon className="nav-icon" size={20} aria-hidden="true" />
                    <span>{item.name}</span>
                  </Link>
                ) : item.children && item.groupId ? (
                  <button
                    className={`nav-item nav-parent-toggle${isActive ? ' active' : ''}`}
                    type="button"
                    onClick={() => toggleNavGroup(item.groupId)}
                    aria-label={item.name}
                    aria-controls={`${item.groupId}-submenu`}
                    aria-expanded={isGroupExpanded}
                  >
                    <item.icon className="nav-icon" size={20} aria-hidden="true" />
                    <span>{item.name}</span>
                    <ChevronRight className="nav-parent-chevron" size={18} aria-hidden="true" />
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    aria-label={item.name}
                    aria-current={location.pathname === item.href ? 'page' : undefined}
                    data-tooltip={!isSidebarExpanded ? item.name : undefined}
                    onClick={closeMobileSidebar}
                  >
                    <item.icon className="nav-icon" size={20} aria-hidden="true" />
                    <span>{item.name}</span>
                  </Link>
                )}
                {item.children && item.groupId && isSidebarExpanded && (
                  <div
                    id={`${item.groupId}-submenu`}
                    className={`nav-submenu-region${isGroupExpanded ? ' is-open' : ''}`}
                    aria-hidden={!isGroupExpanded}
                  >
                    <div className="nav-submenu">
                      {item.children.map((child) => {
                        const isChildActive = location.pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`nav-item nav-submenu-item${isChildActive ? ' active' : ''}`}
                            aria-current={isChildActive ? 'page' : undefined}
                            onClick={closeMobileSidebar}
                          >
                            <child.icon className="nav-icon" size={18} aria-hidden="true" />
                            <span>{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
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
              className={`icon-button header-profile-action ${location.pathname === '/settings' ? 'active' : ''}`}
              to="/settings"
              aria-label="Open account settings"
              aria-current={location.pathname === '/settings' ? 'page' : undefined}
              data-tooltip="Account settings"
            >
              <UserCircle size={22} />
            </Link>
          </div>
        </header>

        <main className={`content-area animate-fade-in${isDashboard ? ' content-area-dashboard' : ''}`}>
          <div className={`content-wrapper${isDashboard ? ' content-wrapper-dashboard' : ''}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
