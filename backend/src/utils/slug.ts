import slugify from 'slugify';
import { PostModel } from '../models/Post.model';

export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true });
  let candidate = base;
  let suffix = 2;

  while (await PostModel.exists({ slug: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
