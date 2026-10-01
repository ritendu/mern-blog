import { Router } from 'express';
import * as postController from '../controllers/post.controller';
import { validate } from '../middleware/validate.middleware';
import { createPostSchema, updatePostSchema } from '../validators/post.validator';
import { authenticate } from '../middleware/auth.middleware';
import { validateObjectId } from '../middleware/validateObjectId.middleware';
import { logActivity } from '../middleware/activityLogger.middleware';

export const postRouter = Router();

postRouter.get('/mine', authenticate, postController.listMine);
postRouter.get('/', postController.list);
postRouter.get('/:slug', postController.getBySlug);
postRouter.post('/', authenticate, validate(createPostSchema), logActivity('POST_CREATED'), postController.create);
postRouter.patch(
  '/:id',
  authenticate,
  validateObjectId('id'),
  validate(updatePostSchema),
  logActivity('POST_UPDATED'),
  postController.update
);
postRouter.delete('/:id', authenticate, validateObjectId('id'), logActivity('POST_DELETED'), postController.remove);
