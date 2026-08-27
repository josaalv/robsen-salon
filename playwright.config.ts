import { defineConfig, devices } from '@playwright/test'

// Pruebas E2E contra el sitio real (robseninterno.com) — no hay entorno de
// staging separado, así que estas pruebas deben ser de solo lectura /
// no destructivas por defecto (login + navegar + verificar que algo
// aparece), nunca borrar o modificar datos reales sin que quede muy claro
// en el nombre de la prueba.
//
// Credenciales de prueba: nunca hardcodeadas — vienen de variables de
// entorno (ver .env.test.example). El navegador usa el Chromium ya
// instalado en este entorno (no dispara una descarga).
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.ROBSEN_BASE_URL || 'https://robseninterno.com',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Este entorno exige salir por un proxy HTTP local para cualquier
    // tráfico externo (curl/fetch lo toman solo de HTTPS_PROXY;
    // Chromium necesita que se le pase explícito).
    ...(process.env.HTTPS_PROXY || process.env.https_proxy
      ? { proxy: { server: process.env.HTTPS_PROXY || process.env.https_proxy! } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
      },
    },
  ],
})
