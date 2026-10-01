import request from 'supertest';
import { app } from '../app';
import { openApiSpec } from '../docs/openapi';

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  regexp: RegExp;
  handle: { stack?: Layer[] };
}

const API_PREFIX = '/api/v1';

function mountPath(layer: Layer): string {
  return layer.regexp.source.replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
}

function collectRoutes(stack: Layer[], prefix = ''): string[] {
  const found: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        found.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      found.push(...collectRoutes(layer.handle.stack, prefix + mountPath(layer)));
    }
  }
  return found;
}

const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z]+)/g, '{$1}').replace(/(.)\/$/, '$1');

function realOperations(): string[] {
  const router = (app as unknown as { _router: { stack: Layer[] } })._router;
  return collectRoutes(router.stack)
    .filter((entry) => entry.split(' ')[1].startsWith(API_PREFIX))
    .map((entry) => {
      const [method, path] = entry.split(' ');
      return `${method} ${toOpenApiPath(path.slice(API_PREFIX.length))}`;
    })
    .sort();
}

function documentedOperations(): string[] {
  const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
  return Object.entries(paths)
    .flatMap(([path, operations]) => Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`))
    .sort();
}

describe('API documentation', () => {
  it('documents every real endpoint and nothing that does not exist', () => {
    const real = realOperations();
    const documented = documentedOperations();
    expect(real.length).toBeGreaterThan(30);
    expect(documented.filter((op) => !real.includes(op))).toEqual([]);
    expect(real.filter((op) => !documented.includes(op))).toEqual([]);
  });

  it('only references schemas that are defined', () => {
    const spec = JSON.stringify(openApiSpec);
    const defined = Object.keys((openApiSpec.components as { schemas: object }).schemas);
    const referenced = [...spec.matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((name) => !defined.includes(name))).toEqual([]);
  });

  it('serves the spec as JSON and the Swagger UI page', async () => {
    const json = await request(app).get('/api/docs.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toMatch(/^3\./);
    expect(json.body.info.title).toBe('MERN Blog API');

    const ui = await request(app).get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
    expect(ui.text).toContain('MERN Blog API');
  });

  it('marks protected endpoints as requiring a bearer token and public ones as open', () => {
    const paths = openApiSpec.paths as Record<string, Record<string, { security?: unknown }>>;
    expect(paths['/admin/stats'].get.security).toBeDefined();
    expect(paths['/posts'].post.security).toBeDefined();
    expect(paths['/posts'].get.security).toBeUndefined();
    expect(paths['/auth/login'].post.security).toBeUndefined();
  });
});
