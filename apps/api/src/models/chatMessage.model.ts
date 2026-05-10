import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  appointmentId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: string;
  text: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);

