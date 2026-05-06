import mongoose, { Document, Schema } from 'mongoose';

export enum PaymentProvider {
  KHALTI = 'khalti',
  ESEWA = 'esewa',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface IPayment extends Document {
  patientId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  provider: PaymentProvider;
  amount: number;
  transactionId?: string;
  providerReferenceId?: string;
  status: PaymentStatus;
}

const paymentSchema = new Schema<IPayment>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    provider: { type: String, enum: Object.values(PaymentProvider), required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, unique: true, sparse: true },
    providerReferenceId: { type: String },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
