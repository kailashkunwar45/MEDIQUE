import mongoose, { Document, Schema } from 'mongoose';

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  PREMIUM = 'premium',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

const TIER_LIMITS = {
  [SubscriptionTier.FREE]: { maxDoctors: 3, maxAppointmentsPerDay: 50, analytics: false, notifications: false },
  [SubscriptionTier.PRO]: { maxDoctors: 15, maxAppointmentsPerDay: 500, analytics: false, notifications: true },
  [SubscriptionTier.PREMIUM]: { maxDoctors: 999, maxAppointmentsPerDay: 9999, analytics: true, notifications: true },
};

export interface ISubscription extends Document {
  hospitalId: mongoose.Types.ObjectId;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  monthlyFee: number;
  limits: typeof TIER_LIMITS[SubscriptionTier];
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, unique: true },
    tier: { type: String, enum: Object.values(SubscriptionTier), default: SubscriptionTier.FREE },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    monthlyFee: { type: Number, default: 0 },
    limits: { type: Schema.Types.Mixed, default: TIER_LIMITS[SubscriptionTier.FREE] },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
export { TIER_LIMITS };
