import { apiClient } from './axios';
import { Comment, PaginatedComments } from '../types/comment.types';

export const commentApi = {
  async list(postId: string, page = 1, limit = 10): Promise<PaginatedComments> {
    const res = await apiClient.get(`/posts/${postId}/comments`, { params: { page, limit } });
    return res.data.data;
  },
  async create(postId: string, content: string): Promise<Comment> {
    const res = await apiClient.post(`/posts/${postId}/comments`, { content });
    return res.data.data;
  },
  async update(id: string, content: string): Promise<Comment> {
    const res = await apiClient.patch(`/comments/${id}`, { content });
    return res.data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/comments/${id}`);
  },
};
