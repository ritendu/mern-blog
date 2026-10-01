import { CommentModel, IComment } from '../models/Comment.model';
import { PostModel } from '../models/Post.model';
import '../models/User.model';
import { AppError } from '../utils/AppError';
import { notifyQuietly } from './notification.service';
import { buildPaginationMeta, clampPagination } from '../utils/pagination';
import { PaginatedComments, PublicComment } from '../types/comment.types';
import { UserRole } from '../types/auth.types';

export function toPublicComment(comment: IComment): PublicComment {
  const populated = comment.author as unknown as { _id: unknown; name: string } | null;
  const hasAuthorDoc = !!populated && typeof populated === 'object' && 'name' in populated;
  return {
    id: String(comment._id),
    postId: String(comment.post),
    content: comment.content,
    author: {
      id: hasAuthorDoc ? String(populated._id) : String(comment.author ?? ''),
      name: hasAuthorDoc ? populated.name : '',
    },
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

async function findActivePost(postId: string) {
  const post = await PostModel.findOne({ _id: postId, isDeleted: false }).select('author slug title');
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  return post;
}

async function findCommentOrFail(commentId: string): Promise<IComment> {
  const comment = await CommentModel.findById(commentId);
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  return comment;
}

function assertCanModify(comment: IComment, userId: string, role: UserRole): void {
  if (comment.author.toString() !== userId && role !== 'admin') {
    throw new AppError('You do not have permission to modify this comment', 403, 'FORBIDDEN');
  }
}

export async function listComments(postId: string, page: number, limit: number): Promise<PaginatedComments> {
  await findActivePost(postId);
  const clamped = clampPagination(page, limit);
  const filter = { post: postId };
  const [docs, total] = await Promise.all([
    CommentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .populate('author', 'name')
      .exec(),
    CommentModel.countDocuments(filter),
  ]);
  return { comments: docs.map(toPublicComment), pagination: buildPaginationMeta(clamped.page, clamped.limit, total) };
}

export async function createComment(postId: string, authorId: string, content: string): Promise<PublicComment> {
  const post = await findActivePost(postId);
  const comment = await CommentModel.create({ post: postId, author: authorId, content });
  const populated = await comment.populate('author', 'name');
  const result = toPublicComment(populated);
  if (post.author.toString() !== authorId) {
    await notifyQuietly(
      post.author.toString(),
      'comment',
      `${result.author.name || 'Someone'} commented on "${post.title}"`,
      `/posts/${post.slug}`
    );
  }
  return result;
}

export async function updateComment(
  commentId: string,
  userId: string,
  role: UserRole,
  content: string
): Promise<PublicComment> {
  const comment = await findCommentOrFail(commentId);
  assertCanModify(comment, userId, role);
  comment.content = content;
  await comment.save();
  const populated = await comment.populate('author', 'name');
  return toPublicComment(populated);
}

export async function deleteComment(commentId: string, userId: string, role: UserRole): Promise<void> {
  const comment = await findCommentOrFail(commentId);
  assertCanModify(comment, userId, role);
  await comment.deleteOne();
  if (comment.author.toString() !== userId) {
    await notifyQuietly(comment.author.toString(), 'moderation', 'An administrator removed one of your comments');
  }
}
