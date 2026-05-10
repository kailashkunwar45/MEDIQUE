const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = 'doc_fx_56114@mediqueue.com';
    const password = 'DFx@56114!!';
    
    const user = await mongoose.connection.collection('users').findOne({ email });
    if (!user) {
      console.log('User not found');
      process.exit(0);
    }
    
    const match = await bcrypt.compare(password, user.password);
    console.log('Password match:', match);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
