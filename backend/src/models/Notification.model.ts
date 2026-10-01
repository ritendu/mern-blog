import { Schema, model, Document, Model, Types } from 'mongoose';

export type NotificationType = 'comment' | 'moderation';

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['comment', 'moderation'], required: true },
    message: { type: String, required: true, maxlength: 300 },
    link: { type: String, default: '/' },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

export const NotificationModel: Model<INotification> = model<INotification>('Notification', notificationSchema);
