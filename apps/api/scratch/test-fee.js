require('dotenv/config');
const mongoose = require('mongoose');
const { User } = require('./src/models/user.model');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'doc_fx_56114@mediqueue.com' });
  console.log("Found user:", user.email, user._id);
  
  try {
    user.pendingFeeUpdate = {
      newFee: 500,
      status: 'pending',
      requestedAt: new Date()
    };
    await user.save();
    console.log("Save successful!");
  } catch (e) {
    console.error("Save failed:", e);
  }
  
  mongoose.disconnect();
}
run();
