import { test, expect } from '@playwright/test';
import { createFrontend } from '../src/server.js';
import { mock, listen, close } from '../test-support/servers.js';
let backend, frontend, origin;
test.beforeEach(async ({ page }) => {
  backend = await mock(); frontend = createFrontend({ backendOrigin: backend.origin }); origin = await listen(frontend);
  await page.goto(origin);
});
test.afterEach(async () => { if (frontend) await close(frontend); if (backend) await backend.close(); });
function json(status, data, delay = 0) { backend.handler = (_req, res) => { const respond = () => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); }; if (delay) backend.delay(respond, delay); else respond(); }; }
async function submit(page, destination = 'https://destination.test/path?q=1#f') { await page.getByLabel('Destination URL').fill(destination); await page.getByRole('button', { name: 'Shorten URL' }).click(); }
test('accessible keyboard submission, exact selectable link, same-origin JSON and pending state', async ({ page }) => {
  const shortUrl = origin + '/s/Code%2fvalue?q=%2F#part'; json(201, { shortUrl });
  await expect(page.getByLabel('Destination URL')).toBeVisible(); await expect(page.getByRole('button', { name: 'Shorten URL' })).toBeVisible();
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Destination URL')).toBeFocused(); await page.keyboard.type('  https://destination.test/path?q=1#f  '); await page.keyboard.press('Enter');
  const link = page.getByRole('link'); await expect(link).toHaveText(shortUrl); await expect(link).toHaveAttribute('href', shortUrl);
  expect(backend.requests[0].method).toBe('POST'); expect(backend.requests[0].url).toBe('/api/links'); expect(backend.requests[0].headers['content-type']).toBe('application/json'); expect(JSON.parse(backend.requests[0].body)).toEqual({ destinationUrl: '  https://destination.test/path?q=1#f  ' });
  expect(await link.evaluate(el => { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(el); selection.removeAllRanges(); selection.addRange(range); return selection.toString(); })).toBe(shortUrl);
  json(201, { shortUrl }, 500); await submit(page); await expect(link).toHaveCount(0); await expect(page.getByRole('button')).toBeDisabled();
  await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { cancelable: true })); form.dispatchEvent(new Event('submit', { cancelable: true })); });
  await expect(link).toHaveText(shortUrl); expect(backend.requests).toHaveLength(2); await expect(page.getByRole('button')).toBeEnabled();
});
test('reject invalid responses and restore submission', async ({ page }) => {
  for (const data of [{}, { shortUrl: 42 }, { shortUrl: '/s/a' }, { shortUrl: 'javascript:alert(1)' }, { shortUrl: 'https://wrong.test/s/a' }, { shortUrl: origin + '/other/a' }, { shortUrl: origin + '/s/' }, { shortUrl: origin + '/s/a', error: null }]) {
    const status = data.error === null ? 200 : 201; json(status, data); await submit(page); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('link')).toHaveCount(0); await expect(page.getByRole('button')).toBeEnabled();
  }
  backend.handler = (_req, res) => { res.writeHead(201); res.end('{broken'); }; await submit(page); await expect(page.getByRole('alert')).toContainText('Unable');
});
test('safe errors, stale content removal, malformed envelopes, network and HTTP retry', async ({ page }) => {
  json(201, { shortUrl: origin + '/s/first' }); await submit(page); await expect(page.getByRole('link')).toBeVisible();
  const literal = '<img src=x onerror="window.executed=true">'; json(400, { error: { code: 'INVALID_INPUT', message: literal } }); await submit(page); await expect(page.getByRole('alert')).toHaveText(literal); await expect(page.getByRole('link')).toHaveCount(0); expect(await page.evaluate(() => window.executed)).toBeUndefined(); await expect(page.locator('#error img')).toHaveCount(0);
  for (const envelope of [{}, { error: { message: 'missing code' } }, { error: { code: 'X', message: 4 } }]) { json(503, envelope); await submit(page); await expect(page.getByRole('alert')).toContainText('Unable'); }
  json(201, { shortUrl: origin + '/s/retry' }, 300); await submit(page); await expect(page.getByRole('alert')).toBeHidden(); await expect(page.getByRole('link')).toHaveText(origin + '/s/retry');
  await backend.close(); await submit(page); await expect(page.getByRole('alert')).toContainText('backend is unavailable'); await expect(page.getByRole('link')).toHaveCount(0);
  await new Promise(resolve => backend.server.listen(new URL(backend.origin).port, '127.0.0.1', resolve));
  await page.context().setOffline(true); await submit(page); await expect(page.getByRole('alert')).toContainText('Unable'); await expect(page.getByRole('button')).toBeEnabled(); await page.context().setOffline(false);
  json(201, { shortUrl: origin + '/s/recovered' }); await submit(page); await expect(page.getByRole('link')).toHaveText(origin + '/s/recovered');
});
test('form remains available while backend is unavailable', async ({ page }) => { await backend.close(); await page.reload(); await expect(page.getByLabel('Destination URL')).toBeVisible(); await submit(page); await expect(page.getByRole('alert')).toBeVisible(); });
test('follow link through real proxy to exact local destination', async ({ page }) => {
  const destination = await mock();
  try {
    const target = destination.origin + '/books/title?q=%2F#chapter';
    backend.handler = (req, res) => { if (req.url === '/api/links') { res.writeHead(201, { 'content-type': 'application/json' }); res.end(JSON.stringify({ shortUrl: origin + '/s/code' })); } else { res.writeHead(302, { location: target }); res.end(); } };
    await submit(page, target); await page.getByRole('link').click(); await expect(page).toHaveURL(target); expect(destination.requests[0].url).toBe('/books/title?q=%2F'); expect(backend.requests.at(-1).url).toBe('/s/code');
  } finally { await destination.close(); }
});
