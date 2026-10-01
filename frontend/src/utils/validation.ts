// Client-side rules mirror the backend Zod schemas so users get instant, inline feedback.
// The server still validates everything; these messages are for usability only.

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const rules = {
  name(value: string): string | undefined {
    const v = value.trim();
    if (!v) return 'Name is required';
    if (v.length < 2) return 'Name must be at least 2 characters';
    if (v.length > 100) return 'Name must be at most 100 characters';
    return undefined;
  },
  email(value: string): string | undefined {
    const v = value.trim();
    if (!v) return 'Email is required';
    if (!EMAIL_PATTERN.test(v)) return 'Enter a valid email address, like name@example.com';
    if (v.length > 254) return 'Email is too long';
    return undefined;
  },
  newPassword(value: string): string | undefined {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (value.length > 72) return 'Password must be at most 72 characters';
    return undefined;
  },
  existingPassword(value: string): string | undefined {
    return value ? undefined : 'Password is required';
  },
  title(value: string): string | undefined {
    const v = value.trim();
    if (!v) return 'Title is required';
    if (v.length < 3) return 'Title must be at least 3 characters';
    if (v.length > 200) return 'Title must be at most 200 characters';
    return undefined;
  },
  content(value: string): string | undefined {
    const v = value.trim();
    if (!v) return 'Content is required';
    if (v.length < 10) return 'Content must be at least 10 characters';
    return undefined;
  },
};

/** Drops fields without an error, so `Object.keys(result).length === 0` means the form is valid. */
export function collectErrors<K extends string>(checks: Record<K, string | undefined>): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  (Object.keys(checks) as K[]).forEach((key) => {
    if (checks[key]) errors[key] = checks[key];
  });
  return errors;
}
