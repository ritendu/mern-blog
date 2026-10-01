import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { validateObjectId } from '../middleware/validateObjectId.middleware';
import { logActivity } from '../middleware/activityLogger.middleware';
import { commentSchema } from '../validators/comment.validator';

export const commentRouter = Router();

commentRouter.get('/posts/:postId/comments', validateObjectId('postId'), commentController.list);
commentRouter.post(
  '/posts/:postId/comments',
  authenticate,
  validateObjectId('postId'),
  validate(commentSchema),
  logActivity('COMMENT_CREATED'),
  commentController.create
);
commentRouter.patch(
  '/comments/:id',
  authenticate,
  validateObjectId('id'),
  validate(commentSchema),
  logActivity('COMMENT_UPDATED'),
  commentController.update
);
commentRouter.delete(
  '/comments/:id',
  authenticate,
  validateObjectId('id'),
  logActivity('COMMENT_DELETED'),
  commentController.remove
);
