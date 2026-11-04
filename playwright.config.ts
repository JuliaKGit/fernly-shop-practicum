import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config();

const apiURL = process.env.API_URL ?? 'http://localhost:8100';
const webURL = process.env.WEB_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests',
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'npm run start:api',
      url: `${apiURL}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run start:web',
      url: webURL,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /reset\.setup\.ts/,
      use: { baseURL: apiURL },
    },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: { baseURL: apiURL },
      dependencies: ['setup'],
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { baseURL: webURL },
      dependencies: ['setup'],
    },
  ],
});
