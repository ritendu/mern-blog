import { apiClient, setAccessToken } from './axios';
import { User, RegisterInput, LoginInput } from '../types/auth.types';

interface AuthResponseData {
  user: User;
  accessToken: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<User> {
    const res = await apiClient.post<{ data: AuthResponseData }>('/auth/register', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data.user;
  },
  async login(input: LoginInput): Promise<User> {
    const res = await apiClient.post<{ data: AuthResponseData }>('/auth/login', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data.user;
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },
  async me(): Promise<User> {
    const res = await apiClient.get<{ data: User }>('/auth/me');
    return res.data.data;
  },
};
