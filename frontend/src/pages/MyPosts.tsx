import { useEffect, useState } from 'react';
import { Alert, Button, Container, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { PaginatedPosts, Post } from '../types/post.types';
import Pagination from '../components/Pagination';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

export default function MyPosts() {
  const [result, setResult] = useState<PaginatedPosts | null>(null); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState<Post | null>(null); const [deleting, setDeleting] = useState(false);
  function load() { setLoading(true); postApi.listMine(page).then(setResult).catch(() => setError('Unable to load your posts.')).finally(() => setLoading(false)); }
  useEffect(load, [page]);
  async function confirmDelete() { if (!pending) return; setDeleting(true); try { await postApi.remove(pending.id); setPending(null); load(); } catch { setError('Unable to delete post.'); } finally { setDeleting(false); } }
  return <Container fluid className="px-0"><h1>My posts</h1>{loading && <Spinner animation="border" />}{error && <Alert variant="danger">{error}</Alert>}{!loading && !error && result?.posts.length === 0 && <p>You have not written any posts yet.</p>}{result && result.posts.length > 0 && <Table responsive striped hover><thead><tr><th>Title</th><th>Created</th><th>Actions</th></tr></thead><tbody>{result.posts.map((post) => <tr key={post.id}><td><Link to={`/posts/${post.slug}`}>{post.title}</Link></td><td>{new Date(post.createdAt).toLocaleDateString()}</td><td><Link className="btn btn-sm btn-outline-primary me-2" to={`/posts/${post.slug}/edit`}>Edit</Link><Button size="sm" variant="outline-danger" onClick={() => setPending(post)}>Delete</Button></td></tr>)}</tbody></Table>}{result && <Pagination currentPage={result.pagination.page} totalPages={result.pagination.totalPages} onPageChange={setPage} />}<DeleteConfirmModal show={!!pending} itemLabel={pending?.title ?? ''} deleting={deleting} onConfirm={confirmDelete} onCancel={() => setPending(null)} /></Container>;
}
