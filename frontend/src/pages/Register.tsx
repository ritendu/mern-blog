import { useState, FormEvent } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SocialButtons from '../components/SocialButtons';
import FormField from '../components/FormField';
import { collectErrors, FieldErrors, rules } from '../utils/validation';

type Field = 'name' | 'email' | 'password';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function clearError(field: Field) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = collectErrors<Field>({
      name: rules.name(name),
      email: rules.email(email),
      password: rules.newPassword(password),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/');
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Registration failed. The email may already be in use.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hn-auth">
      <Container style={{ maxWidth: 420 }}>
        <Card>
          <Card.Body>
            <Card.Title>Register</Card.Title>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Form onSubmit={handleSubmit} noValidate>
              <FormField
                id="register-name"
                label="Name"
                autoComplete="name"
                value={name}
                error={errors.name}
                onChange={(v) => {
                  setName(v);
                  clearError('name');
                }}
              />
              <FormField
                id="register-email"
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                error={errors.email}
                onChange={(v) => {
                  setEmail(v);
                  clearError('email');
                }}
              />
              <FormField
                id="register-password"
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                error={errors.password}
                onChange={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Registering...' : 'Register'}
              </Button>
            </Form>
            <SocialButtons />
            <div className="mt-3">
              Already have an account? <Link to="/login">Login</Link>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
