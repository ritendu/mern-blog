import { Schema, model, Document, Model, Types } from 'mongoose';

export interface IActivityLog extends Document {
  user: Types.ObjectId | null;
  action: string;
  method: string;
  path: string;
  ip: string;
  statusCode: number;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    ip: { type: String, default: '' },
    statusCode: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

export const ActivityLogModel: Model<IActivityLog> = model<IActivityLog>('ActivityLog', activityLogSchema);
