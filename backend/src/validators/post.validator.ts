import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
    content: z.string().trim().min(10, 'Content must be at least 10 characters'),
  }),
});

export const updatePostSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters').optional(),
      content: z.string().trim().min(10, 'Content must be at least 10 characters').optional(),
    })
    .refine((data) => data.title !== undefined || data.content !== undefined, {
      message: 'At least one of title or content must be provided',
    }),
});
