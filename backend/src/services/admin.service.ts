import { UserModel, IUser } from '../models/User.model';
import { PostModel, IPost } from '../models/Post.model';
import { CommentModel } from '../models/Comment.model';
import { ActivityLogModel } from '../models/ActivityLog.model';
import { toPublicPost } from './post.service';
import { AppError } from '../utils/AppError';
import { buildPaginationMeta, clampPagination } from '../utils/pagination';
import { UserRole } from '../types/auth.types';
import { PostStatusFilter } from '../validators/admin.validator';
import {
  AdminActivity,
  AdminComment,
  AdminPost,
  AdminUser,
  DashboardStats,
  Paginated,
} from '../types/admin.types';

function toAdminUser(user: IUser): AdminUser {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [users, posts, comments] = await Promise.all([
    UserModel.countDocuments(),
    PostModel.countDocuments({ isDeleted: false }),
    CommentModel.countDocuments(),
  ]);
  return { users, posts, comments };
}

export async function listUsers(page: number, limit: number, search?: string): Promise<Paginated<AdminUser>> {
  const clamped = clampPagination(page, limit);
  const filter = search?.trim()
    ? {
        $or: [
          { name: { $regex: escapeRegex(search.trim()), $options: 'i' } },
          { email: { $regex: escapeRegex(search.trim()), $options: 'i' } },
        ],
      }
    : {};
  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .exec(),
    UserModel.countDocuments(filter),
  ]);
  return { items: docs.map(toAdminUser), pagination: buildPaginationMeta(clamped.page, clamped.limit, total) };
}

export async function updateUserRole(targetId: string, role: UserRole, actingAdminId: string): Promise<AdminUser> {
  if (targetId === actingAdminId) {
    throw new AppError('You cannot change your own role', 400, 'CANNOT_MODIFY_SELF');
  }
  const user = await UserModel.findById(targetId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  user.role = role;
  // Invalidate refresh tokens so the new role takes effect at the next sign-in.
  user.tokenVersion += 1;
  await user.save();
  return toAdminUser(user);
}

export async function deleteUser(targetId: string, actingAdminId: string): Promise<void> {
  if (targetId === actingAdminId) {
    throw new AppError('You cannot delete your own account', 400, 'CANNOT_MODIFY_SELF');
  }
  const user = await UserModel.findById(targetId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  await PostModel.updateMany({ author: user._id, isDeleted: false }, { isDeleted: true, deletedAt: new Date() });
  await CommentModel.deleteMany({ author: user._id });
  await user.deleteOne();
}

export async function listAllPosts(
  page: number,
  limit: number,
  status: PostStatusFilter
): Promise<Paginated<AdminPost>> {
  const clamped = clampPagination(page, limit);
  const filter = status === 'all' ? {} : { isDeleted: status === 'deleted' };
  const [docs, total] = await Promise.all([
    PostModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .populate('author', 'name')
      .exec(),
    PostModel.countDocuments(filter),
  ]);
  return {
    items: docs.map((post: IPost) => ({ ...toPublicPost(post), isDeleted: post.isDeleted })),
    pagination: buildPaginationMeta(clamped.page, clamped.limit, total),
  };
}

export async function restorePost(postId: string): Promise<void> {
  const post = await PostModel.findOne({ _id: postId, isDeleted: true });
  if (!post) throw new AppError('Deleted post not found', 404, 'POST_NOT_FOUND');
  post.isDeleted = false;
  post.deletedAt = null;
  await post.save();
}

export async function listAllComments(page: number, limit: number): Promise<Paginated<AdminComment>> {
  const clamped = clampPagination(page, limit);
  const [docs, total] = await Promise.all([
    CommentModel.find()
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .populate('author', 'name')
      .populate('post', 'title slug')
      .exec(),
    CommentModel.countDocuments(),
  ]);
  return {
    items: docs.map((comment) => {
      const author = comment.author as unknown as { _id: unknown; name: string } | null;
      const post = comment.post as unknown as { _id: unknown; title: string; slug: string } | null;
      return {
        id: String(comment._id),
        content: comment.content,
        author: { id: String(author?._id ?? ''), name: author?.name ?? '' },
        post: { id: String(post?._id ?? ''), title: post?.title ?? '(deleted post)', slug: post?.slug ?? '' },
        createdAt: comment.createdAt,
      };
    }),
    pagination: buildPaginationMeta(clamped.page, clamped.limit, total),
  };
}

export async function listActivity(page: number, limit: number): Promise<Paginated<AdminActivity>> {
  const clamped = clampPagination(page, limit);
  const [docs, total] = await Promise.all([
    ActivityLogModel.find()
      .sort({ createdAt: -1 })
      .skip((clamped.page - 1) * clamped.limit)
      .limit(clamped.limit)
      .populate('user', 'name')
      .exec(),
    ActivityLogModel.countDocuments(),
  ]);
  return {
    items: docs.map((log) => {
      const user = log.user as unknown as { _id: unknown; name: string } | null;
      return {
        id: String(log._id),
        action: log.action,
        method: log.method,
        path: log.path,
        user: user && 'name' in user ? { id: String(user._id), name: user.name } : null,
        createdAt: log.createdAt,
      };
    }),
    pagination: buildPaginationMeta(clamped.page, clamped.limit, total),
  };
}
