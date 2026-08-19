const mongoose = require("mongoose");
const chatMessageSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2e3 },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = {
  ChatMessage: ChatMessage,
};
