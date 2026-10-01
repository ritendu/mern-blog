import { useCallback } from 'react';
import { Badge, Table } from 'react-bootstrap';
import { adminApi } from '../../api/admin.api';
import { usePagedData } from '../../hooks/usePagedData';
import DataState from '../../components/DataState';
import Pagination from '../../components/Pagination';

export default function AdminActivity() {
  const fetcher = useCallback((page: number) => adminApi.activity(page), []);
  const { data, setPage, loading, error } = usePagedData(fetcher);
  return (
    <>
      <DataState loading={loading} error={error} empty={data?.items.length === 0} emptyMessage="No activity recorded yet." />
      {data && data.items.length > 0 && (
        <Table responsive hover size="sm" className="align-middle">
          <thead>
            <tr><th>When</th><th>User</th><th>Action</th><th>Request</th></tr>
          </thead>
          <tbody>
            {data.items.map((log) => (
              <tr key={log.id}>
                <td className="text-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name ?? 'Anonymous'}</td>
                <td><Badge bg="secondary">{log.action}</Badge></td>
                <td className="hn-muted small">{log.method} {log.path}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {data && <Pagination currentPage={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />}
    </>
  );
}
