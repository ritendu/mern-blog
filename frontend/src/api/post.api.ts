import { apiClient } from './axios';
import { PaginatedPosts, Post, PostInput } from '../types/post.types';

function data<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export const postApi = {
  async list(page = 1, limit = 10): Promise<PaginatedPosts> {
    return data(await apiClient.get('/posts', { params: { page, limit } }));
  },
  async listMine(page = 1, limit = 10): Promise<PaginatedPosts> {
    return data(await apiClient.get('/posts/mine', { params: { page, limit } }));
  },
  async getBySlug(slug: string): Promise<Post> {
    return data(await apiClient.get(`/posts/${encodeURIComponent(slug)}`));
  },
  async create(input: PostInput): Promise<Post> {
    return data(await apiClient.post('/posts', input));
  },
  async update(id: string, input: PostInput): Promise<Post> {
    return data(await apiClient.patch(`/posts/${id}`, input));
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/posts/${id}`);
  },
};
