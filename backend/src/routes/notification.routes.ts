import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateObjectId } from '../middleware/validateObjectId.middleware';

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get('/', notificationController.list);
notificationRouter.post('/read-all', notificationController.readAll);
notificationRouter.patch('/:id/read', validateObjectId('id'), notificationController.read);
