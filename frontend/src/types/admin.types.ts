import { PaginationMeta, PostAuthor } from './post.types';
import { UserRole } from './auth.types';

export interface DashboardStats {
  users: number;
  posts: number;
  comments: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminPost {
  id: string;
  title: string;
  slug: string;
  author: PostAuthor;
  isDeleted: boolean;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  content: string;
  author: PostAuthor;
  post: { id: string; title: string; slug: string };
  createdAt: string;
}

export interface AdminActivity {
  id: string;
  action: string;
  method: string;
  path: string;
  user: PostAuthor | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type PostStatusFilter = 'active' | 'deleted' | 'all';
