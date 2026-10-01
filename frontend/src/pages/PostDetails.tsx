import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { Post } from '../types/post.types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import CommentSection from '../components/CommentSection';
import { formatDate, readTime } from '../utils/format';

export default function PostDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    postApi.getBySlug(slug).then(setPost).catch(() => setPost(null)).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="text-center my-5"><Spinner animation="border" /></div>;
  if (!post) return <Alert variant="danger">Post not found.</Alert>;

  const author = post.author.name || 'Unknown author';
  const canModify = !!user && (user.id === post.author.id || user.role === 'admin');
  return (
    <>
    <article className="hn-article">
      <h1>{post.title}</h1>
      <div className="d-flex align-items-center gap-2 my-3">
        <Avatar name={author} />
        <div className="lh-sm">
          <div className="fw-semibold">{author}</div>
          <div className="hn-muted small">{formatDate(post.createdAt)} · {readTime(post.content)}</div>
        </div>
        {canModify && (
          <Link to={`/posts/${post.slug}/edit`} className="ms-auto">
            <Button variant="outline-primary" size="sm">Edit</Button>
          </Link>
        )}
      </div>
      <div className="hn-article-body">{post.content}</div>
    </article>
    <CommentSection postId={post.id} />
    </>
  );
}
