import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { commentApi } from '../api/comment.api';
import { Comment, PaginatedComments } from '../types/comment.types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import Avatar from './Avatar';
import Pagination from './Pagination';
import DeleteConfirmModal from './DeleteConfirmModal';
import { formatDate } from '../utils/format';

function errorMessage(err: unknown, fallback: string): string {
  return axios.isAxiosError(err) ? err.response?.data?.error?.message ?? fallback : fallback;
}

export default function CommentSection({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { subscribe } = useNotifications();
  const { pathname } = useLocation();
  const [result, setResult] = useState<PaginatedComments | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    commentApi
      .list(postId, page)
      .then((data) => {
        setResult(data);
        setError(null);
      })
      .catch(() => setError('Unable to load comments.'))
      .finally(() => setLoading(false));
  }, [postId, page]);

  useEffect(load, [load]);

  // A comment notification for the post that is open right now: show the new comment without a reload.
  useEffect(
    () =>
      subscribe((notification) => {
        if (notification.type === 'comment' && notification.link === pathname) load();
      }),
    [subscribe, pathname, load]
  );

  async function addComment(event: FormEvent) {
    event.preventDefault();
    setPosting(true);
    setError(null);
    try {
      await commentApi.create(postId, draft);
      setDraft('');
      if (page === 1) load();
      else setPage(1);
    } catch (err) {
      setError(errorMessage(err, 'Unable to post comment.'));
    } finally {
      setPosting(false);
    }
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      await commentApi.update(id, editDraft);
      setEditingId(null);
      load();
    } catch (err) {
      setError(errorMessage(err, 'Unable to update comment.'));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await commentApi.remove(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(errorMessage(err, 'Unable to delete comment.'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="hn-panel mt-4" aria-label="Comments">
      <h2 className="h5 fw-bold mb-3">Comments {result ? `(${result.pagination.total})` : ''}</h2>
      {user ? (
        <Form onSubmit={addComment} className="mb-4">
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Write a comment..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            required
          />
          <Button type="submit" className="mt-2" disabled={posting || !draft.trim()}>
            {posting ? 'Posting...' : 'Comment'}
          </Button>
        </Form>
      ) : (
        <Alert variant="light" className="border">
          <Link to="/login">Log in</Link> to join the discussion.
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div className="text-center"><Spinner animation="border" size="sm" /></div>}
      {!loading && result?.comments.length === 0 && <p className="hn-muted">No comments yet.</p>}
      {result?.comments.map((comment) => {
        const canModify = !!user && (user.id === comment.author.id || user.role === 'admin');
        const name = comment.author.name || 'Unknown author';
        return (
          <div key={comment.id} className="d-flex gap-2 mb-3">
            <Avatar name={name} size={32} />
            <div className="flex-grow-1">
              <div className="small">
                <span className="fw-semibold">{name}</span>{' '}
                <span className="hn-muted">{formatDate(comment.createdAt)}</span>
              </div>
              {editingId === comment.id ? (
                <>
                  <Form.Control as="textarea" rows={2} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} maxLength={2000} />
                  <Button size="sm" className="mt-2 me-2" disabled={!editDraft.trim()} onClick={() => saveEdit(comment.id)}>Save</Button>
                  <Button size="sm" variant="outline-secondary" className="mt-2" onClick={() => setEditingId(null)}>Cancel</Button>
                </>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</div>
              )}
              {canModify && editingId !== comment.id && (
                <div className="mt-1">
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 me-3"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditDraft(comment.content);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setPendingDelete(comment)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {result && (
        <Pagination currentPage={result.pagination.page} totalPages={result.pagination.totalPages} onPageChange={setPage} />
      )}
      <DeleteConfirmModal
        show={!!pendingDelete}
        itemType="comment"
        itemLabel={pendingDelete?.content.slice(0, 60) ?? ''}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
