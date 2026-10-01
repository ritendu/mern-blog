import bcrypt from 'bcryptjs';
import { UserModel, IUser } from '../models/User.model';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(user: IUser): TokenPair {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), tokenVersion: user.tokenVersion });
  return { accessToken, refreshToken };
}

export async function registerUser(
  input: RegisterInput
): Promise<{ user: IUser } & TokenPair> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
  }
  let user: IUser;
  try {
    user = await UserModel.create({
      name: input.name,
      email: input.email,
      password: input.password,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 11000) {
      throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
    }
    throw err;
  }
  return { user, ...issueTokens(user) };
}

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-placeholder', 10);

export async function loginUser(input: LoginInput): Promise<{ user: IUser } & TokenPair> {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const matches = await user.comparePassword(input.password);
  if (!matches) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  return { user, ...issueTokens(user) };
}

export async function refreshTokens(incomingRefreshToken: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  return issueTokens(user);
}

export async function logoutUser(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}
