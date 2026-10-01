import { PostModel, IPost } from '../models/Post.model';
import '../models/User.model'; // ensure 'User' schema is registered for populate('author')
import { generateUniqueSlug } from '../utils/slug';
import { AppError } from '../utils/AppError';
import { notifyQuietly } from './notification.service';
import { CreatePostInput, UpdatePostInput, PaginatedPosts, PublicPost } from '../types/post.types';
import { UserRole } from '../types/auth.types';

const MAX_PAGE_SIZE = 50;

export function toPublicPost(post: IPost): PublicPost {
  // populate('author', 'name') replaces `author` with the populated User doc, or
  // with null if the referenced user no longer exists (e.g. test fixtures that use
  // a bare ObjectId with no backing User document) — guard against both shapes.
  const populatedAuthor = post.author as unknown as { _id: unknown; name: string } | null;
  const authorId =
    populatedAuthor && typeof populatedAuthor === 'object' && '_id' in populatedAuthor
      ? String(populatedAuthor._id)
      : String(post.author ?? '');
  const authorName = populatedAuthor?.name ?? '';
  return {
    id: String(post._id),
    title: post.title,
    content: post.content,
    slug: post.slug,
    author: { id: authorId, name: authorName },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function paginate(filter: Record<string, unknown>, page: number, limit: number): Promise<PaginatedPosts> {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const clampedPage = Math.max(page, 1);

  const [docs, total] = await Promise.all([
    PostModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((clampedPage - 1) * clampedLimit)
      .limit(clampedLimit)
      .populate('author', 'name')
      .exec(),
    PostModel.countDocuments(filter),
  ]);

  return {
    posts: docs.map(toPublicPost),
    pagination: {
      page: clampedPage,
      limit: clampedLimit,
      total,
      totalPages: total === 0 ? 1 : Math.ceil(total / clampedLimit),
    },
  };
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<IPost> {
  // Two concurrent posts with the same title can pick the same slug; the unique index
  // rejects the loser, which then simply retries with a fresh slug.
  for (let attempt = 0; ; attempt += 1) {
    const slug = await generateUniqueSlug(input.title);
    try {
      return await PostModel.create({ title: input.title, content: input.content, author: authorId, slug });
    } catch (err) {
      const duplicate = (err as { code?: unknown }).code === 11000;
      if (!duplicate || attempt >= 4) throw err;
    }
  }
}

export async function listPosts(page: number, limit: number): Promise<PaginatedPosts> {
  return paginate({ isDeleted: false }, page, limit);
}

export async function listMyPosts(authorId: string, page: number, limit: number): Promise<PaginatedPosts> {
  return paginate({ isDeleted: false, author: authorId }, page, limit);
}

export async function getPostBySlug(slug: string): Promise<IPost> {
  const post = await PostModel.findOne({ slug, isDeleted: false }).populate('author', 'name');
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }
  return post;
}

async function findOwnedPostOrFail(postId: string): Promise<IPost> {
  const post = await PostModel.findOne({ _id: postId, isDeleted: false });
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }
  return post;
}

function assertCanModify(post: IPost, requestingUserId: string, requestingUserRole: UserRole): void {
  const isOwner = post.author.toString() === requestingUserId;
  const isAdmin = requestingUserRole === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to modify this post', 403, 'FORBIDDEN');
  }
}

export async function updatePost(
  postId: string,
  requestingUserId: string,
  requestingUserRole: UserRole,
  input: UpdatePostInput
): Promise<IPost> {
  const post = await findOwnedPostOrFail(postId);
  assertCanModify(post, requestingUserId, requestingUserRole);

  if (input.title !== undefined) post.title = input.title;
  if (input.content !== undefined) post.content = input.content;
  await post.save();
  return post;
}

export async function deletePost(
  postId: string,
  requestingUserId: string,
  requestingUserRole: UserRole
): Promise<void> {
  const post = await findOwnedPostOrFail(postId);
  assertCanModify(post, requestingUserId, requestingUserRole);

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();
  if (post.author.toString() !== requestingUserId) {
    await notifyQuietly(post.author.toString(), 'moderation', `An administrator removed your post "${post.title}"`, '/my-posts');
  }
}
