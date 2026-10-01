import { useEffect, useState } from 'react';
import { apiClient } from '../api/axios';

interface Providers {
  google: boolean;
  facebook: boolean;
}

const none: Providers = { google: false, facebook: false };

export default function SocialButtons() {
  const [providers, setProviders] = useState<Providers>(none);

  useEffect(() => {
    apiClient
      .get<{ data: Providers }>('/auth/providers')
      .then((res) => setProviders(res.data.data))
      .catch(() => setProviders(none));
  }, []);

  const base = apiClient.defaults.baseURL;
  const anyDisabled = !providers.google || !providers.facebook;

  function button(enabled: boolean, label: string, path: string, variant: string) {
    return enabled ? (
      <a className={`btn btn-outline-${variant}`} href={`${base}/auth/${path}`}>{label}</a>
    ) : (
      <button type="button" className={`btn btn-outline-${variant}`} disabled title="Not configured on the server">
        {label}
      </button>
    );
  }

  return (
    <div className="mt-3">
      <div className="text-center hn-muted small mb-2">or continue with</div>
      <div className="d-grid gap-2">
        {button(providers.google, 'Continue with Google', 'google', 'secondary')}
        {button(providers.facebook, 'Continue with Facebook', 'facebook', 'primary')}
      </div>
      {anyDisabled && (
        <div className="hn-muted small mt-2 text-center">
          Greyed-out options need OAuth credentials in the backend <code>.env</code> (see README).
        </div>
      )}
    </div>
  );
}
