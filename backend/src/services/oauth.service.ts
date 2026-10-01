import { UserModel, IUser } from '../models/User.model';
import { AppError } from '../utils/AppError';

export type OAuthProvider = 'google' | 'facebook';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  name?: string;
}

const idField = { google: 'googleId', facebook: 'facebookId' } as const;

/**
 * Finds the user for a social identity, linking it to an existing account with
 * the same (provider-verified) email, or creating a new password-less account.
 */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<IUser> {
  const field = idField[profile.provider];

  const linked = await UserModel.findOne({ [field]: profile.providerId });
  if (linked) return linked;

  const email = profile.email?.toLowerCase().trim();
  if (!email) {
    throw new AppError('Your account did not share an email address', 400, 'OAUTH_NO_EMAIL');
  }

  const existing = await UserModel.findOne({ email });
  if (existing) {
    existing[field] = profile.providerId;
    await existing.save();
    return existing;
  }

  return UserModel.create({
    name: profile.name?.trim() || email.split('@')[0],
    email,
    [field]: profile.providerId,
  });
}
