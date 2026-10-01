import mongoose from 'mongoose';
import { PostModel } from '../models/Post.model';
import { generateUniqueSlug } from '../utils/slug';

describe('generateUniqueSlug', () => {
  it('slugifies a simple title', async () => {
    const slug = await generateUniqueSlug('Hello World');
    expect(slug).toBe('hello-world');
  });

  it('strips special characters and lowercases', async () => {
    const slug = await generateUniqueSlug('  My Awesome Post!! 2024  ');
    expect(slug).toBe('my-awesome-post-2024');
  });

  it('appends a numeric suffix when the base slug is taken', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({
      title: 'Hello World',
      content: 'Content long enough to pass validation rules here.',
      author: authorId,
      slug: 'hello-world',
    });
    const slug = await generateUniqueSlug('Hello World');
    expect(slug).toBe('hello-world-2');
  });

  it('increments past multiple existing collisions', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({ title: 'Duplicate', content: 'Content long enough to pass validation.', author: authorId, slug: 'dup' });
    await PostModel.create({ title: 'Duplicate Post', content: 'Content long enough to pass validation.', author: authorId, slug: 'dup-2' });
    const slug = await generateUniqueSlug('Dup');
    expect(slug).toBe('dup-3');
  });
});
