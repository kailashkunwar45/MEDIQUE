import mongoose, { Document, Schema } from 'mongoose';

export interface IHospital extends Document {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  subscriptionTier: 'free' | 'pro' | 'premium';
  isActive: boolean;
}

const hospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    subscriptionTier: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Hospital = mongoose.model<IHospital>('Hospital', hospitalSchema);
