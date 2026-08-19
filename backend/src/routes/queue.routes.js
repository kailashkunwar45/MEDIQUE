const express = require("express");
const queue = require("../controllers/queue.controller");
const auth = require("../middlewares/auth.middleware");
const user = require("../models/user.model");
const router = express.Router();
router.get("/status", auth.protect, queue.getQueueStatus);
router.post("/call-next", auth.protect, (auth.authorize)(user.UserRole.DOCTOR), queue.callNextPatient);
module.exports = router;
