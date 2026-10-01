import { PaginationMeta, PostAuthor } from './post.types';

export interface Comment {
  id: string;
  postId: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedComments {
  comments: Comment[];
  pagination: PaginationMeta;
}
