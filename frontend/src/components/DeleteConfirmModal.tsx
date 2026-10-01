import { Button, Modal } from 'react-bootstrap';

interface Props {
  show: boolean;
  itemLabel: string;
  itemType?: string;
  deleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ show, itemLabel, itemType = 'post', deleting, onConfirm, onCancel }: Props) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete {itemType}?</Modal.Title>
      </Modal.Header>
      <Modal.Body>Delete "{itemLabel}"? This action cannot be undone.</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={deleting}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
      </Modal.Footer>
    </Modal>
  );
}
