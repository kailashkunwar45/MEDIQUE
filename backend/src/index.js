const dotenv = require("dotenv");
const app = require("./app");
const db = require("./config/db");
const http = require("http");
const socket = require("./socket");
dotenv.config();
const PORT = process.env.PORT || 5e3;
(db.connectDB)().then(async () => {
  const server = (http.createServer)(app);
  await (socket.initSocket)(server);
  server.listen(PORT, () => {
    console.log(`Server running in ${"development"} mode on port ${PORT}`);
  });
});
