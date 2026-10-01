import { Badge, Dropdown, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import { AppNotification } from '../types/notification.types';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  function open(notification: AppNotification) {
    if (!notification.read) markRead(notification.id).catch(() => undefined);
    navigate(notification.link);
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle variant="outline-secondary" size="sm" className="position-relative hn-bell" aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z" />
        </svg>
        {unreadCount > 0 && (
          <Badge bg="danger" pill className="position-absolute top-0 start-100 translate-middle" data-testid="unread-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>
      <Dropdown.Menu className="hn-notifications">
        <div className="d-flex justify-content-between align-items-center px-3 py-1">
          <strong>Notifications</strong>
          <button className="btn btn-link btn-sm p-0" disabled={unreadCount === 0} onClick={() => markAllRead().catch(() => undefined)}>
            Mark all read
          </button>
        </div>
        <Dropdown.Divider />
        {notifications.length === 0 && <div className="px-3 py-2 hn-muted small">You are all caught up.</div>}
        {notifications.map((n) => (
          <Dropdown.Item key={n.id} onClick={() => open(n)} className={`hn-notification${n.read ? '' : ' unread'}`}>
            <div className="small text-wrap">{n.message}</div>
            <div className="hn-muted" style={{ fontSize: '0.75rem' }}>{timeAgo(n.createdAt)}</div>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications();
  const navigate = useNavigate();
  return (
    <ToastContainer className="p-3 hn-toasts">
      {toasts.map((toast) => (
        <Toast key={toast.id} autohide delay={6000} onClose={() => dismissToast(toast.id)} role="status">
          <Toast.Header>
            <strong className="me-auto">{toast.type === 'comment' ? 'New comment' : 'Moderation notice'}</strong>
            <small>just now</small>
          </Toast.Header>
          <Toast.Body
            style={{ cursor: 'pointer' }}
            onClick={() => {
              dismissToast(toast.id);
              navigate(toast.link);
            }}
          >
            {toast.message}
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}
