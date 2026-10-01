import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { confirmAdminInDb, requireRole } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { validateObjectId } from '../middleware/validateObjectId.middleware';
import { logActivity } from '../middleware/activityLogger.middleware';
import { updateRoleSchema } from '../validators/admin.validator';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('admin'), confirmAdminInDb);

adminRouter.get('/stats', adminController.stats);
adminRouter.get('/activity', adminController.activity);

adminRouter.get('/users', adminController.users);
adminRouter.patch(
  '/users/:id/role',
  validateObjectId('id'),
  validate(updateRoleSchema),
  logActivity('ADMIN_USER_ROLE_CHANGED'),
  adminController.changeRole
);
adminRouter.delete('/users/:id', validateObjectId('id'), logActivity('ADMIN_USER_DELETED'), adminController.removeUser);

adminRouter.get('/posts', adminController.posts);
adminRouter.delete('/posts/:id', validateObjectId('id'), logActivity('ADMIN_POST_DELETED'), adminController.removePost);
adminRouter.patch('/posts/:id/restore', validateObjectId('id'), logActivity('ADMIN_POST_RESTORED'), adminController.restore);

adminRouter.get('/comments', adminController.comments);
adminRouter.delete('/comments/:id', validateObjectId('id'), logActivity('ADMIN_COMMENT_DELETED'), adminController.removeComment);
