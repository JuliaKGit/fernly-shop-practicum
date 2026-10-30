import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import { issueToken, requireUser } from './auth.js';
import { ApiError } from './errors.js';
import { openApiDocument, registry } from './openapi.js';
import {
  CartLineCreateSchema,
  CartLineUpdateSchema,
  LoginSchema,
  OrderCreateSchema,
  PlantQuerySchema,
  RegisterSchema,
} from './schemas.js';
import { store } from './store.js';

export interface FeatureContext {
  router: Router;
  registry: typeof registry;
  requireUser: typeof requireUser;
  /** Runs the callback on every POST /api/admin/reset, so a feature can restore its own seed data. */
  onReset: (reset: () => void) => void;
}

const resets: (() => void)[] = [];

/** Every file in src/features/ that exports register(ctx) is loaded at startup. */
async function loadFeatures(ctx: FeatureContext): Promise<string[]> {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'features');
  const files = readdirSync(dir).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')).sort();
  for (const file of files) {
    const mod = (await import(pathToFileURL(path.join(dir, file)).href)) as { register?: (ctx: FeatureContext) => void };
    mod.register?.(ctx);
  }
  return files;
}

function describeZodError(error: ZodError): string {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)).join('; ');
}

export async function createApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.post('/admin/reset', (_req, res) => {
    store.seed();
    for (const reset of resets) reset();
    res.json({ status: 'reset' });
  });

  api.get('/plants', (req, res) => {
    res.json(store.listPlants(PlantQuerySchema.parse(req.query)));
  });
  api.get('/plants/:plantId', (req, res) => {
    res.json(store.getPlant(req.params.plantId));
  });

  api.post('/auth/register', (req, res) => {
    const body = RegisterSchema.parse(req.body ?? {});
    const user = store.register(body.name, body.email, body.password);
    res.status(201).json({ token: issueToken(user), user });
  });
  api.post('/auth/login', (req, res) => {
    const body = LoginSchema.parse(req.body ?? {});
    const user = store.login(body.email, body.password);
    res.json({ token: issueToken(user), user });
  });
  api.get('/auth/me', (req, res) => {
    res.json(requireUser(req));
  });

  api.get('/cart', (req, res) => {
    res.json(store.cart(requireUser(req).id));
  });
  api.post('/cart/lines', (req, res) => {
    const user = requireUser(req);
    const body = CartLineCreateSchema.parse(req.body ?? {});
    res.json(store.addLine(user.id, body.plantId, body.size, body.quantity));
  });
  api.patch('/cart/lines/:lineId', (req, res) => {
    const user = requireUser(req);
    const body = CartLineUpdateSchema.parse(req.body ?? {});
    res.json(store.updateLine(user.id, req.params.lineId, body.quantity));
  });
  api.delete('/cart/lines/:lineId', (req, res) => {
    res.json(store.removeLine(requireUser(req).id, req.params.lineId));
  });

  api.post('/orders', (req, res) => {
    const user = requireUser(req);
    const body = OrderCreateSchema.parse(req.body ?? {});
    res.status(201).json(store.placeOrder(user.id, body.shippingAddress));
  });
  api.get('/orders', (req, res) => {
    res.json(store.listOrders(requireUser(req).id));
  });
  api.get('/orders/:orderId', (req, res) => {
    res.json(store.getOrder(requireUser(req).id, req.params.orderId));
  });

  const features = await loadFeatures({ router: api, registry, requireUser, onReset: (reset) => resets.push(reset) });
  if (features.length) console.log(`Features loaded: ${features.join(', ')}`);

  app.use('/api', api);
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument());
  });
  app.use('/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) =>
    swaggerUi.setup(openApiDocument(), { customSiteTitle: 'Fernly Shop API' })(req, res, next),
  );

  app.use((req, res) => {
    res.status(404).json({ detail: `Route ${req.method} ${req.path} not found.` });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ detail: describeZodError(err), rule: 'validation_error' });
      return;
    }
    if (err instanceof ApiError) {
      res.status(err.status).json(err.rule ? { detail: err.message, rule: err.rule } : { detail: err.message });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ detail: 'Request body is not valid JSON.', rule: 'validation_error' });
      return;
    }
    console.error(err);
    res.status(500).json({ detail: 'Internal server error.' });
  });
  return app;
}
