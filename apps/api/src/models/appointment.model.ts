import mongoose, { Document, Schema } from 'mongoose';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  date: Date;
  status: AppointmentStatus;
  paymentMethod: 'online' | 'pay_later';
  paymentStatus: 'paid' | 'unpaid';
  acceptedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  forfeited?: boolean; // if paid & cancelled => no refund
  tokenNumber?: number;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: AppointmentStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'pay_later'],
      default: 'pay_later',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid'],
      default: 'unpaid',
    },
    acceptedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    forfeited: { type: Boolean, default: false },
    tokenNumber: { type: Number },
  },
  {
    timestamps: true,
  }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
