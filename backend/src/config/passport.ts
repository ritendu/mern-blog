import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { env } from './env';
import { findOrCreateOAuthUser, OAuthProvider } from '../services/oauth.service';

export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'google') return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
}

export function configurePassport(): void {
  if (isProviderConfigured('google')) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${env.API_URL}/api/v1/auth/google/callback`,
        },
        (_accessToken, _refreshToken, profile, done) => {
          const verified = (profile._json as { email_verified?: boolean }).email_verified !== false;
          findOrCreateOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email: verified ? profile.emails?.[0]?.value : undefined,
            name: profile.displayName,
          })
            .then((user) => done(null, user as unknown as Express.User))
            .catch((err) => done(err));
        }
      )
    );
  }

  if (isProviderConfigured('facebook')) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: env.FACEBOOK_APP_ID,
          clientSecret: env.FACEBOOK_APP_SECRET,
          callbackURL: `${env.API_URL}/api/v1/auth/facebook/callback`,
          profileFields: ['id', 'displayName', 'emails'],
        },
        (_accessToken, _refreshToken, profile, done) => {
          findOrCreateOAuthUser({
            provider: 'facebook',
            providerId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
          })
            .then((user) => done(null, user as unknown as Express.User))
            .catch((err) => done(err));
        }
      )
    );
  }
}
