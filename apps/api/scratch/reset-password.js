const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const password = 'DFx@56114!!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const res = await mongoose.connection.collection('users').updateOne(
      { email: 'doc_fx_56114@mediqueue.com' },
      { $set: { password: hashedPassword } }
    );
    console.log(res.modifiedCount > 0 ? 'Password reset SUCCESS' : 'User not found or password already same');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
