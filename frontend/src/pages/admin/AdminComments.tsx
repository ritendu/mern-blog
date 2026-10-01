import { useCallback, useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { adminApi } from '../../api/admin.api';
import { AdminComment } from '../../types/admin.types';
import { usePagedData } from '../../hooks/usePagedData';
import DataState from '../../components/DataState';
import Pagination from '../../components/Pagination';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { excerpt, formatDate } from '../../utils/format';

export default function AdminComments() {
  const fetcher = useCallback((page: number) => adminApi.comments(page), []);
  const { data, setPage, loading, error, setError, reload } = usePagedData(fetcher);
  const [pending, setPending] = useState<AdminComment | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await adminApi.deleteComment(pending.id);
      setPending(null);
      reload();
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error?.message ?? 'Unable to delete comment.' : 'Unable to delete comment.');
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DataState loading={loading} error={error} empty={data?.items.length === 0} emptyMessage="No comments yet." />
      {data && data.items.length > 0 && (
        <Table responsive hover className="align-middle">
          <thead>
            <tr><th>Comment</th><th>Author</th><th>Post</th><th>Date</th><th /></tr>
          </thead>
          <tbody>
            {data.items.map((comment) => (
              <tr key={comment.id}>
                <td style={{ maxWidth: 320 }}>{excerpt(comment.content, 100)}</td>
                <td>{comment.author.name || 'Unknown'}</td>
                <td>{comment.post.slug ? <Link to={`/posts/${comment.post.slug}`}>{comment.post.title}</Link> : comment.post.title}</td>
                <td>{formatDate(comment.createdAt)}</td>
                <td className="text-end">
                  <Button size="sm" variant="outline-danger" onClick={() => setPending(comment)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {data && <Pagination currentPage={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />}
      <DeleteConfirmModal
        show={!!pending}
        itemType="comment"
        itemLabel={pending ? excerpt(pending.content, 60) : ''}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
