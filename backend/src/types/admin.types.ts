import { PaginationMeta } from './comment.types';
import { PublicAuthor, PublicPost } from './post.types';
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
  createdAt: Date;
}

export interface AdminPost extends PublicPost {
  isDeleted: boolean;
}

export interface AdminComment {
  id: string;
  content: string;
  author: PublicAuthor;
  post: { id: string; title: string; slug: string };
  createdAt: Date;
}

export interface AdminActivity {
  id: string;
  action: string;
  method: string;
  path: string;
  user: PublicAuthor | null;
  createdAt: Date;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}
