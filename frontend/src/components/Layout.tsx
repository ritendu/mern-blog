import { useEffect, useState } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import NotificationBell, { NotificationToasts } from './NotificationBell';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const navClass = ({ isActive }: { isActive: boolean }) => `hn-nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="hn-shell">
      <header className="hn-topbar">
        <Link to="/" className="hn-brand">MERN<span>Blog</span></Link>
        <div className="ms-auto d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          {user ? (
            <>
              <NotificationBell />
              <Link to="/posts/new" className="btn btn-primary btn-sm">Write</Link>
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="p-0 border-0 hn-avatar-toggle" aria-label="Account menu">
                  <Avatar name={user.name} />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Header>
                    {user.name}
                    <div className="small">{user.role}</div>
                  </Dropdown.Header>
                  <Dropdown.Item as={Link} to="/dashboard">Dashboard</Dropdown.Item>
                  <Dropdown.Item as={Link} to="/my-posts">My posts</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item
                    onClick={() => {
                      logout().catch(() => undefined).finally(() => navigate('/'));
                    }}
                  >
                    Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline-primary btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </header>
      {user && <NotificationToasts />}
      <div className="hn-body">
        <nav className="hn-sidebar" aria-label="Main">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          {user && <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>}
          {user && <NavLink to="/my-posts" className={navClass}>My posts</NavLink>}
          {user && <NavLink to="/posts/new" className={navClass}>Write a post</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
        </nav>
        <main className="hn-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
