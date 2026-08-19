const mongoose = require("mongoose");
const queueSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    currentToken: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);
const Queue = mongoose.model("Queue", queueSchema);

module.exports = {
  Queue: Queue,
};
