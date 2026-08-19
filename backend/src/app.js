const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const express_rate_limit = require("express-rate-limit");
const path = require("path");
const auth = require("./routes/auth.routes");
const appointment = require("./routes/appointment.routes");
const queue = require("./routes/queue.routes");
const payment = require("./routes/payment.routes");
const analytics = require("./routes/analytics.routes");
const hospital = require("./routes/hospital.routes");
const review = require("./routes/review.routes");
const chat = require("./routes/chat.routes");
const user = require("./routes/user.routes");
const hospitalAdmin = require("./routes/hospitalAdmin.routes");
const superAdmin = require("./routes/superAdmin.routes");
const app = express();
const limiter = express_rate_limit({
  windowMs: 60 * 1e3,
  max: 1e3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
});
app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false
    // Disable CSP for easier frontend integration in this setup
  })
);
app.use(morgan("dev"));
app.use(limiter);
app.use("/api/auth", auth);
app.use("/api/appointments", appointment);
app.use("/api/queues", queue);
app.use("/api/payments", payment);
app.use("/api/analytics", analytics);
app.use("/api/hospitals", hospital);
app.use("/api/reviews", review);
app.use("/api/chat", chat);
app.use("/api/users", user);
app.use("/api/hospital-admin", hospitalAdmin);
app.use("/api/super-admin", superAdmin);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "MediQueue API is running" });
});
const webOutPath = path.join(__dirname, "../../frontend/out");
app.use(express.static(webOutPath));
app.use((req, res) => {
  if (req.path.startsWith("/api") || path.extname(req.path)) {
    return res.status(404).json({ message: "Resource not found" });
  }
  res.sendFile(path.join(webOutPath, "index.html"));
});
module.exports = app;
