import { Nav } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/posts', label: 'Posts' },
  { to: '/admin/comments', label: 'Comments' },
  { to: '/admin/activity', label: 'Activity' },
];

export default function AdminLayout() {
  return (
    <>
      <h1 className="h3 fw-bold mb-3">Admin panel</h1>
      <Nav variant="pills" className="mb-4 flex-wrap gap-1">
        {links.map((link) => (
          <Nav.Item key={link.to}>
            <NavLink to={link.to} end={link.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {link.label}
            </NavLink>
          </Nav.Item>
        ))}
      </Nav>
      <Outlet />
    </>
  );
}
