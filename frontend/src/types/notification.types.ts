import { PaginationMeta } from './post.types';

export interface AppNotification {
  id: string;
  type: 'comment' | 'moderation';
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: PaginationMeta;
}
