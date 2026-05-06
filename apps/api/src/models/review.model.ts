import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  doctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
}

const reviewSchema = new Schema<IReview>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

reviewSchema.index({ doctorId: 1, patientId: 1, appointmentId: 1 }, { unique: true, sparse: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);

