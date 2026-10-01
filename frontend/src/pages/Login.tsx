import { useState, FormEvent } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SocialButtons from '../components/SocialButtons';
import FormField from '../components/FormField';
import { collectErrors, FieldErrors, rules } from '../utils/validation';

type Field = 'email' | 'password';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
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
      email: rules.email(email),
      password: rules.existingPassword(password),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/');
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Invalid email or password';
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
            <Card.Title>Login</Card.Title>
            {formError && <Alert variant="danger">{formError}</Alert>}
            {!formError && oauthError && (
              <Alert variant="danger">Social login failed ({oauthError.replace(/_/g, ' ')}). Please try again.</Alert>
            )}
            <Form onSubmit={handleSubmit} noValidate>
              <FormField
                id="login-email"
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
                id="login-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                error={errors.password}
                onChange={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Logging in...' : 'Login'}
              </Button>
            </Form>
            <SocialButtons />
            <div className="mt-3">
              Don&apos;t have an account? <Link to="/register">Register</Link>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
