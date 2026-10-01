import { Router } from 'express';
import { finishOAuth, listProviders, startOAuth } from '../controllers/oauth.controller';

export const oauthRouter = Router();

oauthRouter.get('/providers', listProviders);
oauthRouter.get('/google', startOAuth('google'));
oauthRouter.get('/google/callback', finishOAuth('google'));
oauthRouter.get('/facebook', startOAuth('facebook'));
oauthRouter.get('/facebook/callback', finishOAuth('facebook'));
