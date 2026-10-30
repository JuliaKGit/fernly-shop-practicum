import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 8100);
const app = await createApp();

const server = app.listen(port, () => {
  console.log(`Fernly API on http://localhost:${port}  ·  Swagger UI http://localhost:${port}/docs`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or run with API_PORT=8101.`);
    process.exit(1);
  }
  throw error;
});
