import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config();

const apiURL = process.env.API_URL ?? 'http://localhost:8100';
const webURL = process.env.WEB_URL ?? 'http://localhost:5173';

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      './tests/a11y/reporter.ts',
      {
        outputFolder: 'a11y-report',
        baseline: 'tests/a11y/a11y-baseline.json',
        title: 'Fernly accessibility',
      },
    ],
  ],
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
      testDir: './tests/api',
      use: { baseURL: apiURL },
      dependencies: ['setup'],
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { baseURL: webURL },
      dependencies: ['setup'],
    },
    {
      name: 'a11y',
      testDir: './tests/a11y',
      testMatch: '**/*.spec.ts',
      use: { baseURL: webURL },
      dependencies: ['setup'],
    },
  ],
});
