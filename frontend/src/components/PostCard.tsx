import { Link } from 'react-router-dom';
import { Post } from '../types/post.types';
import { excerpt, formatDate, readTime } from '../utils/format';
import Avatar from './Avatar';

export default function PostCard({ post }: { post: Post }) {
  const author = post.author.name || 'Unknown author';
  return (
    <article className="hn-card">
      <div className="d-flex align-items-center gap-2 mb-2">
        <Avatar name={author} size={32} />
        <div className="lh-sm">
          <div className="fw-semibold small">{author}</div>
          <div className="hn-muted small">{formatDate(post.createdAt)} · {readTime(post.content)}</div>
        </div>
      </div>
      <h2 className="hn-card-title">
        <Link to={`/posts/${post.slug}`}>{post.title}</Link>
      </h2>
      <p className="hn-muted mb-0">{excerpt(post.content)}</p>
    </article>
  );
}
