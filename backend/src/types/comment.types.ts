import { PublicAuthor } from './post.types';

export interface PublicComment {
  id: string;
  postId: string;
  content: string;
  author: PublicAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedComments {
  comments: PublicComment[];
  pagination: PaginationMeta;
}
