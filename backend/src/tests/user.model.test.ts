import { UserModel } from '../models/User.model';

describe('User model', () => {
  it('hashes the password before saving and allows comparePassword to verify it', async () => {
    const user = await UserModel.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'plaintext123',
    });

    expect(user.password).not.toBe('plaintext123');
    const matches = await user.comparePassword('plaintext123');
    expect(matches).toBe(true);
    const wrong = await user.comparePassword('wrongpass');
    expect(wrong).toBe(false);
  });

  it('defaults role to user and tokenVersion to 0', async () => {
    const user = await UserModel.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'plaintext123',
    });
    expect(user.role).toBe('user');
    expect(user.tokenVersion).toBe(0);
  });

  it('rejects duplicate emails at the schema/index level', async () => {
    await UserModel.create({ name: 'A', email: 'dup@example.com', password: 'x1234567' });
    await expect(
      UserModel.create({ name: 'B', email: 'dup@example.com', password: 'y1234567' })
    ).rejects.toThrow();
  });
});
