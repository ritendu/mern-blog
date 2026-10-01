import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { PaginatedPosts } from '../types/post.types';
import Pagination from '../components/Pagination';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

export default function PostList() {
  const { user } = useAuth();
  const [result, setResult] = useState<PaginatedPosts | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    postApi
      .list(page)
      .then(setResult)
      .catch(() => setError('Unable to load posts.'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      {!user && (
        <div className="hn-card text-center">
          <h1 className="h3 fw-bold">Share your ideas with the world</h1>
          <p className="hn-muted">Read stories from the community or start writing your own.</p>
          <Link to="/register" className="btn btn-primary">Get started</Link>
        </div>
      )}
      <h1 className="h4 fw-bold mb-3">Latest posts</h1>
      {loading && <div className="text-center my-4"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && result?.posts.length === 0 && (
        <Alert variant="info">No posts yet. Be the first to write one.</Alert>
      )}
      {result?.posts.map((post) => <PostCard key={post.id} post={post} />)}
      {result && (
        <Pagination
          currentPage={result.pagination.page}
          totalPages={result.pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
