import mongoose, { Document, Schema } from 'mongoose';

export interface IQueue extends Document {
  hospitalId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  date: Date;
  currentToken: number;
  totalTokens: number;
  isActive: boolean;
}

const queueSchema = new Schema<IQueue>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    currentToken: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Queue = mongoose.model<IQueue>('Queue', queueSchema);
