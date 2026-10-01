import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { PaginatedPosts } from '../types/post.types';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';

export default function Dashboard() {
  const { user } = useAuth();
  const [mine, setMine] = useState<PaginatedPosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    postApi
      .listMine(1, 5)
      .then(setMine)
      .catch(() => setError('Unable to load your dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-0">Welcome back, {user?.name}</h1>
          <div className="hn-muted">Here is a quick look at your blog.</div>
        </div>
        <Link to="/posts/new" className="btn btn-primary ms-auto">Write a post</Link>
      </div>
      {loading && <div className="text-center my-4"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {mine && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-4">
              <div className="hn-stat">
                <div className="hn-muted small mb-1">Total posts</div>
                <div className="hn-stat-value">{mine.pagination.total}</div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-4">
              <div className="hn-stat">
                <div className="hn-muted small mb-1">Role</div>
                <div className="hn-stat-value text-capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
          <h2 className="h5 fw-bold mb-3">Recent posts</h2>
          {mine.posts.length === 0 && <Alert variant="info">You have not written any posts yet.</Alert>}
          {mine.posts.map((post) => <PostCard key={post.id} post={post} />)}
          {mine.pagination.total > 5 && <Link to="/my-posts">View all your posts</Link>}
        </>
      )}
    </>
  );
}
