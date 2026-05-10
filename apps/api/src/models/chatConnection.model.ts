import mongoose, { Schema, Document } from 'mongoose';

export enum ChatConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DENIED = 'denied',
  CLOSED = 'closed',
}

export interface IChatConnection extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  status: ChatConnectionStatus;
  initiatedBy: 'patient' | 'doctor';
  lastActivity: Date;
}

const chatConnectionSchema = new Schema<IChatConnection>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(ChatConnectionStatus),
      default: ChatConnectionStatus.PENDING,
    },
    initiatedBy: {
      type: String,
      enum: ['patient', 'doctor'],
      required: true,
    },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ChatConnection = mongoose.model<IChatConnection>('ChatConnection', chatConnectionSchema);
