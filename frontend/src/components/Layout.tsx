import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: '대시보드', icon: null },
    { path: '/devices', label: '장비 관리', icon: null },
    { path: '/metrics', label: '메트릭', icon: null },
    { path: '/alarms', label: '알람', icon: null },
    { path: '/ai', label: 'AI 분석', icon: null },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ path: '/users', label: '사용자 관리', icon: null });
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14"/>
            </svg>
          </button>
          <h1 className="logo">NetScopeNMS</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            {user?.username}
            {user?.role && <span className="user-role">({user.role})</span>}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <div className="main-container">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="nav-menu">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};

