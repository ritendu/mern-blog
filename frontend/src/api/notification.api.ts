import { apiClient } from './axios';
import { NotificationList } from '../types/notification.types';

export const notificationApi = {
  async list(limit = 10): Promise<NotificationList> {
    const res = await apiClient.get('/notifications', { params: { limit } });
    return res.data.data;
  },
  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  },
};
