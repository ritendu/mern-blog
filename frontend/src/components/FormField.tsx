import { Form } from 'react-bootstrap';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  autoComplete?: string;
}

export default function FormField({ id, label, value, onChange, error, type = 'text', as = 'input', rows = 4, autoComplete }: Props) {
  return (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      {as === 'textarea' ? (
        <Form.Control
          as="textarea"
          rows={rows}
          value={value}
          isInvalid={!!error}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Form.Control
          type={type}
          value={value}
          autoComplete={autoComplete}
          isInvalid={!!error}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}
