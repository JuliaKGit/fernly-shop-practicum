import { OpenAPIRegistry, OpenApiGeneratorV31, type RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AuthResultSchema,
  CartLineCreateSchema,
  CartLineUpdateSchema,
  CartSchema,
  ErrorSchema,
  LoginSchema,
  OrderCreateSchema,
  OrderListSchema,
  OrderSchema,
  PlantListSchema,
  PlantQuerySchema,
  PlantSchema,
  RegisterSchema,
  UserSchema,
} from './schemas.js';

export const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearer', { type: 'http', scheme: 'bearer' });

export const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
export const ok = (description: string, schema: z.ZodTypeAny) => ({ description, ...json(schema) });
export const error = (description: string) => ({ description, ...json(ErrorSchema) });
export const secured = [{ bearer: [] }];

const id = (name: string, example: string) => z.object({ [name]: z.string().openapi({ example }) });

const routes: RouteConfig[] = [
  { method: 'get', path: '/api/health', tags: ['System'], summary: 'Check that the API is running', responses: { 200: ok('Up.', z.object({ status: z.literal('ok') })) } },
  { method: 'post', path: '/api/admin/reset', tags: ['System'], summary: 'Reset all data to the seed state', responses: { 200: ok('Reset.', z.object({ status: z.literal('reset') })) } },
  {
    method: 'get',
    path: '/api/plants',
    tags: ['Catalog'],
    summary: 'Browse plants',
    description: 'Search matches the name or the Latin name, ignoring case. light accepts several values. petSafe=true keeps only pet-safe plants. Sorts: featured, price-asc (lowest first), price-desc (highest first), name (A–Z), rating (highest first).',
    request: { query: PlantQuerySchema },
    responses: { 200: ok('One page of plants.', PlantListSchema), 400: error('Invalid query (validation_error).') },
  },
  { method: 'get', path: '/api/plants/{plantId}', tags: ['Catalog'], summary: 'Get one plant', request: { params: id('plantId', 'pl-monstera') }, responses: { 200: ok('The plant.', PlantSchema), 404: error('Unknown plant.') } },
  { method: 'post', path: '/api/auth/register', tags: ['Account'], summary: 'Create an account', request: { body: json(RegisterSchema) }, responses: { 201: ok('Signed in.', AuthResultSchema), 400: error('Invalid body or email_taken.') } },
  { method: 'post', path: '/api/auth/login', tags: ['Account'], summary: 'Sign in', request: { body: json(LoginSchema) }, responses: { 200: ok('Signed in.', AuthResultSchema), 401: error('invalid_credentials.') } },
  { method: 'get', path: '/api/auth/me', tags: ['Account'], summary: 'The signed-in customer', security: secured, responses: { 200: ok('The customer.', UserSchema), 401: error('auth_required.') } },
  { method: 'get', path: '/api/cart', tags: ['Cart'], summary: 'Get my cart', description: 'Shipping is 6.95, and free when the subtotal is 50.00 or more. An empty cart has no shipping.', security: secured, responses: { 200: ok('My cart.', CartSchema), 401: error('auth_required.') } },
  { method: 'post', path: '/api/cart/lines', tags: ['Cart'], summary: 'Add a plant to my cart', description: 'Adding the same plant and size again increases that line. A line can never exceed the plant\'s stock (rule: stock_limit).', security: secured, request: { body: json(CartLineCreateSchema) }, responses: { 200: ok('My cart.', CartSchema), 400: error('validation_error or stock_limit.'), 401: error('auth_required.'), 404: error('Unknown plant.') } },
  { method: 'patch', path: '/api/cart/lines/{lineId}', tags: ['Cart'], summary: 'Change a quantity', security: secured, request: { params: id('lineId', 'ln-1a2b3c4d'), body: json(CartLineUpdateSchema) }, responses: { 200: ok('My cart.', CartSchema), 400: error('validation_error or stock_limit.'), 401: error('auth_required.'), 404: error('Not a line in my cart.') } },
  { method: 'delete', path: '/api/cart/lines/{lineId}', tags: ['Cart'], summary: 'Remove a line', security: secured, request: { params: id('lineId', 'ln-1a2b3c4d') }, responses: { 200: ok('My cart.', CartSchema), 401: error('auth_required.'), 404: error('Not a line in my cart.') } },
  { method: 'post', path: '/api/orders', tags: ['Orders'], summary: 'Place an order from my cart', description: 'Charges the cart as it is, lowers stock, and empties the cart.', security: secured, request: { body: json(OrderCreateSchema) }, responses: { 201: ok('The order.', OrderSchema), 400: error('validation_error, empty_cart or stock_limit.'), 401: error('auth_required.') } },
  { method: 'get', path: '/api/orders', tags: ['Orders'], summary: 'List my orders', security: secured, responses: { 200: ok('My orders, newest first.', OrderListSchema), 401: error('auth_required.') } },
  { method: 'get', path: '/api/orders/{orderId}', tags: ['Orders'], summary: 'Get one of my orders', description: 'Only the customer who placed an order can see it; anyone else gets 404.', security: secured, request: { params: id('orderId', 'ord-1a2b3c4d') }, responses: { 200: ok('The order.', OrderSchema), 401: error('auth_required.'), 404: error('Not one of my orders.') } },
];

for (const route of routes) registry.registerPath(route);

export function openApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Fernly Shop API',
      version: '1.0.0',
      description: 'The API behind the Fernly practice shop. Data lives in memory and resets on restart or with POST /api/admin/reset. Rejected requests return {"detail": "...", "rule": "..."}; 404 responses have no rule.',
    },
    servers: [{ url: `http://localhost:${process.env.API_PORT ?? 8100}` }],
  });
}
