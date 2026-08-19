const express = require("express");
const review = require("../controllers/review.controller");
const auth = require("../middlewares/auth.middleware");
const user = require("../models/user.model");
const router = express.Router();
router.post("/", auth.protect, (auth.authorize)(user.UserRole.PATIENT), review.addReview);
router.get("/doctor/:doctorId", auth.protect, review.getDoctorReviews);
module.exports = router;
