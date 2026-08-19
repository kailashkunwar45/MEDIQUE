const mongoose = require("mongoose");
var ChatConnectionStatus = /* @__PURE__ */ ((ChatConnectionStatus2) => {
  ChatConnectionStatus2["PENDING"] = "pending";
  ChatConnectionStatus2["ACTIVE"] = "active";
  ChatConnectionStatus2["DENIED"] = "denied";
  ChatConnectionStatus2["CLOSED"] = "closed";
  return ChatConnectionStatus2;
})(ChatConnectionStatus || {});
const chatConnectionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(ChatConnectionStatus),
      default: "pending" /* PENDING */
    },
    initiatedBy: {
      type: String,
      enum: ["patient", "doctor"],
      required: true
    },
    lastActivity: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
const ChatConnection = mongoose.model("ChatConnection", chatConnectionSchema);

module.exports = {
  ChatConnection: ChatConnection,
  ChatConnectionStatus: ChatConnectionStatus,
};
