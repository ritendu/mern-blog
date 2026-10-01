import { INotification, NotificationModel, NotificationType } from '../models/Notification.model';
import { emitToUser } from '../config/socket';
import { AppError } from '../utils/AppError';
import { buildPaginationMeta, clampPagination } from '../utils/pagination';

export interface PublicNotification {
  id: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: Date;
}

function toPublic(n: INotification): PublicNotification {
  return { id: String(n._id), type: n.type, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt };
}

/** Stores the notification (so offline users still get it) and pushes it live over Socket.io. */
export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  link = '/'
): Promise<PublicNotification> {
  const doc = await NotificationModel.create({ user: userId, type, message: message.slice(0, 300), link });
  const payload = toPublic(doc);
  emitToUser(userId, 'notification', payload);
  return payload;
}

/** Notifications are a side effect: a failure here must never break the action that triggered it. */
export async function notifyQuietly(
  userId: string,
  type: NotificationType,
  message: string,
  link?: string
): Promise<void> {
  try {
    await createNotification(userId, type, message, link);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create notification', err);
  }
}

export async function listNotifications(userId: string, page: number, limit: number) {
  const clamped = clampPagination(page, limit);
  const [docs, total, unreadCount] = await Promise.all([
    NotificationModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .exec(),
    NotificationModel.countDocuments({ user: userId }),
    NotificationModel.countDocuments({ user: userId, read: false }),
  ]);
  return {
    notifications: docs.map(toPublic),
    unreadCount,
    pagination: buildPaginationMeta(clamped.page, clamped.limit, total),
  };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const result = await NotificationModel.updateOne({ _id: notificationId, user: userId }, { read: true });
  if (result.matchedCount === 0) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
}

export async function markAllRead(userId: string): Promise<void> {
  await NotificationModel.updateMany({ user: userId, read: false }, { read: true });
}
