import { Pagination as BootstrapPagination } from 'react-bootstrap';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <BootstrapPagination className="justify-content-center">
      <BootstrapPagination.Prev disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} />
      <BootstrapPagination.Item active>{currentPage}</BootstrapPagination.Item>
      <BootstrapPagination.Next disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} />
    </BootstrapPagination>
  );
}
