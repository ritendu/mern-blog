import mongoose from 'mongoose';
import { PostModel } from '../models/Post.model';

describe('Post model', () => {
  it('creates a post with required fields and sensible defaults', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const post = await PostModel.create({
      title: 'Hello World',
      content: 'This is my first post, long enough to pass validation.',
      author: authorId,
      slug: 'hello-world',
    });
    expect(post.title).toBe('Hello World');
    expect(post.author.toString()).toBe(authorId.toString());
    expect(post.isDeleted).toBe(false);
    expect(post.deletedAt).toBeNull();
    expect(post.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate slugs at the schema/index level', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({
      title: 'Title A',
      content: 'Content long enough to pass validation rules here.',
      author: authorId,
      slug: 'dup-slug',
    });
    await expect(
      PostModel.create({
        title: 'Title B',
        content: 'Different content but the same slug value as above.',
        author: authorId,
        slug: 'dup-slug',
      })
    ).rejects.toThrow();
  });

  it('requires title, content, author, and slug', async () => {
    await expect(PostModel.create({})).rejects.toThrow();
  });
});
