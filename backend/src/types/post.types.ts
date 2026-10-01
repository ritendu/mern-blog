import { Types } from 'mongoose';

export interface CreatePostInput {
  title: string;
  content: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}

export interface PublicAuthor {
  id: string;
  name: string;
}

export interface PublicPost {
  id: string;
  title: string;
  content: string;
  slug: string;
  author: PublicAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedPosts {
  posts: PublicPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type { Types };
