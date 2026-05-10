import mongoose, { Document, Schema } from 'mongoose';

export type ReviewTargetType = 'doctor' | 'hospital';

export interface IReview extends Document {
  targetType: ReviewTargetType;
  doctorId?: mongoose.Types.ObjectId;
  hospitalId?: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
}

const reviewSchema = new Schema<IReview>(
  {
    targetType: { type: String, enum: ['doctor', 'hospital'], required: true, default: 'doctor' },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

reviewSchema.index({ targetType: 1, doctorId: 1, patientId: 1, appointmentId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ targetType: 1, hospitalId: 1, patientId: 1 }, { sparse: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);

