import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User.model';

// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 npm run seed:admin
// Creates the admin, or promotes the user if the email is already registered.
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || !password || password.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 characters)');
  }
  await mongoose.connect(env.MONGO_URI);
  const existing = await UserModel.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
    console.log(`Promoted existing user ${email} to admin`);
  } else {
    await UserModel.create({ name, email, password, role: 'admin' });
    console.log(`Created admin ${email}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
