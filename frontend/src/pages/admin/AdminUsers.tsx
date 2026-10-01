import { FormEvent, useCallback, useState } from 'react';
import { Alert, Badge, Button, Form, InputGroup, Table } from 'react-bootstrap';
import axios from 'axios';
import { adminApi } from '../../api/admin.api';
import { AdminUser } from '../../types/admin.types';
import { useAuth } from '../../context/AuthContext';
import { usePagedData } from '../../hooks/usePagedData';
import DataState from '../../components/DataState';
import Pagination from '../../components/Pagination';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { formatDate } from '../../utils/format';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const fetcher = useCallback((page: number) => adminApi.users(page, query), [query]);
  const { data, setPage, loading, error, setError, reload } = usePagedData(fetcher);
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  function message(err: unknown, fallback: string): string {
    return axios.isAxiosError(err) ? err.response?.data?.error?.message ?? fallback : fallback;
  }

  async function changeRole(target: AdminUser) {
    try {
      await adminApi.setRole(target.id, target.role === 'admin' ? 'user' : 'admin');
      reload();
    } catch (err) {
      setError(message(err, 'Unable to change role.'));
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(pending.id);
      setPending(null);
      reload();
    } catch (err) {
      setError(message(err, 'Unable to delete user.'));
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search);
  }

  return (
    <>
      <Form onSubmit={submitSearch} className="mb-3">
        <InputGroup>
          <Form.Control placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline-primary">Search</Button>
        </InputGroup>
      </Form>
      <Alert variant="warning" className="small">
        Deleting a user also hides their posts and removes their comments.
      </Alert>
      <DataState loading={loading} error={error} empty={data?.items.length === 0} emptyMessage="No users found." />
      {data && data.items.length > 0 && (
        <Table responsive hover className="align-middle">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th /></tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td><Badge bg={item.role === 'admin' ? 'primary' : 'secondary'}>{item.role}</Badge></td>
                <td>{formatDate(item.createdAt)}</td>
                <td className="text-end text-nowrap">
                  {item.id === me?.id ? (
                    <span className="hn-muted small">You</span>
                  ) : (
                    <>
                      <Button size="sm" variant="outline-primary" className="me-2" onClick={() => changeRole(item)}>
                        Make {item.role === 'admin' ? 'user' : 'admin'}
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => setPending(item)}>Delete</Button>
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
        itemType="user"
        itemLabel={pending?.email ?? ''}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
