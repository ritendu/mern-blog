import { FormEvent, useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import axios from 'axios';
import FormField from './FormField';
import { PostInput } from '../types/post.types';
import { collectErrors, FieldErrors, rules } from '../utils/validation';

type Field = 'title' | 'content';

interface Props {
  heading: string;
  submitLabel: string;
  savingLabel: string;
  initial?: PostInput;
  onSubmit: (input: PostInput) => Promise<void>;
}

export default function PostForm({ heading, submitLabel, savingLabel, initial, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: Field) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = collectErrors<Field>({ title: rules.title(title), content: rules.content(content) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
    } catch (err) {
      setFormError(
        axios.isAxiosError(err) ? err.response?.data?.error?.message ?? 'Something went wrong.' : 'Something went wrong.'
      );
      setSaving(false);
    }
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      <Card.Body>
        <Card.Title>{heading}</Card.Title>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Form onSubmit={submit} noValidate>
          <FormField
            id="post-title"
            label="Title"
            value={title}
            error={errors.title}
            onChange={(v) => {
              setTitle(v);
              clearError('title');
            }}
          />
          <FormField
            id="post-content"
            label="Content"
            as="textarea"
            rows={10}
            value={content}
            error={errors.content}
            onChange={(v) => {
              setContent(v);
              clearError('content');
            }}
          />
          <Button type="submit" disabled={saving}>
            {saving ? savingLabel : submitLabel}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
