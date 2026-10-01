import { useCallback, useState } from 'react';
import { Badge, Button, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { adminApi } from '../../api/admin.api';
import { AdminPost, PostStatusFilter } from '../../types/admin.types';
import { usePagedData } from '../../hooks/usePagedData';
import DataState from '../../components/DataState';
import Pagination from '../../components/Pagination';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { formatDate } from '../../utils/format';

export default function AdminPosts() {
  const [status, setStatus] = useState<PostStatusFilter>('active');
  const fetcher = useCallback((page: number) => adminApi.posts(page, status), [status]);
  const { data, setPage, loading, error, setError, reload } = usePagedData(fetcher);
  const [pending, setPending] = useState<AdminPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  function message(err: unknown, fallback: string): string {
    return axios.isAxiosError(err) ? err.response?.data?.error?.message ?? fallback : fallback;
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await adminApi.deletePost(pending.id);
      setPending(null);
      reload();
    } catch (err) {
      setError(message(err, 'Unable to delete post.'));
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  async function restore(post: AdminPost) {
    try {
      await adminApi.restorePost(post.id);
      reload();
    } catch (err) {
      setError(message(err, 'Unable to restore post.'));
    }
  }

  return (
    <>
      <Form.Select
        className="mb-3"
        style={{ maxWidth: 220 }}
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value as PostStatusFilter);
        }}
        aria-label="Filter by status"
      >
        <option value="active">Active posts</option>
        <option value="deleted">Deleted posts</option>
        <option value="all">All posts</option>
      </Form.Select>
      <DataState loading={loading} error={error} empty={data?.items.length === 0} emptyMessage="No posts found." />
      {data && data.items.length > 0 && (
        <Table responsive hover className="align-middle">
          <thead>
            <tr><th>Title</th><th>Author</th><th>Created</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {data.items.map((post) => (
              <tr key={post.id}>
                <td>{post.isDeleted ? post.title : <Link to={`/posts/${post.slug}`}>{post.title}</Link>}</td>
                <td>{post.author.name || 'Unknown'}</td>
                <td>{formatDate(post.createdAt)}</td>
                <td><Badge bg={post.isDeleted ? 'danger' : 'success'}>{post.isDeleted ? 'deleted' : 'active'}</Badge></td>
                <td className="text-end text-nowrap">
                  {post.isDeleted ? (
                    <Button size="sm" variant="outline-success" onClick={() => restore(post)}>Restore</Button>
                  ) : (
                    <>
                      <Link to={`/posts/${post.slug}/edit`} className="btn btn-sm btn-outline-primary me-2">Edit</Link>
                      <Button size="sm" variant="outline-danger" onClick={() => setPending(post)}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {data && <Pagination currentPage={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />}
      <DeleteConfirmModal
        show={!!pending}
        itemLabel={pending?.title ?? ''}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
