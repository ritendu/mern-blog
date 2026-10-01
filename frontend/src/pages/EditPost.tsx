import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { Post } from '../types/post.types';
import PostForm from '../components/PostForm';

export default function EditPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    postApi
      .getBySlug(slug)
      .then(setPost)
      .catch(() => setError('Unable to load post.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="text-center my-4"><Spinner animation="border" /></div>;
  if (error || !post) return <Alert variant="danger">{error ?? 'Post not found.'}</Alert>;

  return (
    <PostForm
      heading="Edit post"
      submitLabel="Save changes"
      savingLabel="Saving..."
      initial={{ title: post.title, content: post.content }}
      onSubmit={async (input) => {
        const updated = await postApi.update(post.id, input);
        navigate(`/posts/${updated.slug}`);
      }}
    />
  );
}
