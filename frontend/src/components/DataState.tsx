import { Alert, Spinner } from 'react-bootstrap';

interface Props {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
}

export default function DataState({ loading, error, empty, emptyMessage = 'Nothing to show.' }: Props) {
  return (
    <>
      {loading && <div className="text-center my-3"><Spinner animation="border" size="sm" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && empty && <Alert variant="info">{emptyMessage}</Alert>}
    </>
  );
}
