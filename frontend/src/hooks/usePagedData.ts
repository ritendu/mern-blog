import { useCallback, useEffect, useState } from 'react';
import { Paginated } from '../types/admin.types';

export function usePagedData<T>(fetcher: (page: number) => Promise<Paginated<T>>) {
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetcher(page)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError('Unable to load data. Please try again.'))
      .finally(() => setLoading(false));
  }, [fetcher, page]);

  useEffect(reload, [reload]);

  return { data, page, setPage, loading, error, setError, reload };
}
