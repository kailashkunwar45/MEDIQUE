const express = require("express");
const analytics = require("../controllers/analytics.controller");
const auth = require("../middlewares/auth.middleware");
const user = require("../models/user.model");
const cache = require("../middlewares/cache.middleware");
const router = express.Router();
router.get("/hospital", auth.protect, (auth.authorize)(user.UserRole.HOSPITAL_ADMIN), (cache.cacheMiddleware)(300), analytics.getHospitalStats);
router.get("/platform", auth.protect, (auth.authorize)(user.UserRole.SUPER_ADMIN), (cache.cacheMiddleware)(300), analytics.getPlatformStats);
module.exports = router;
