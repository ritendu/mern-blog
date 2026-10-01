import { apiClient } from './axios';
import {
  AdminActivity,
  AdminComment,
  AdminPost,
  AdminUser,
  DashboardStats,
  Paginated,
  PostStatusFilter,
} from '../types/admin.types';
import { UserRole } from '../types/auth.types';

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get(`/admin${url}`, { params });
  return res.data.data;
}

export const adminApi = {
  stats: () => get<DashboardStats>('/stats'),
  users: (page: number, q: string) => get<Paginated<AdminUser>>('/users', { page, q: q || undefined }),
  setRole: async (id: string, role: UserRole): Promise<void> => {
    await apiClient.patch(`/admin/users/${id}/role`, { role });
  },
  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${id}`);
  },
  posts: (page: number, status: PostStatusFilter) => get<Paginated<AdminPost>>('/posts', { page, status }),
  deletePost: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/posts/${id}`);
  },
  restorePost: async (id: string): Promise<void> => {
    await apiClient.patch(`/admin/posts/${id}/restore`);
  },
  comments: (page: number) => get<Paginated<AdminComment>>('/comments', { page }),
  deleteComment: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/comments/${id}`);
  },
  activity: (page: number) => get<Paginated<AdminActivity>>('/activity', { page }),
};
