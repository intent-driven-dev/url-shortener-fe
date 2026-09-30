const form = document.querySelector('form');
const button = form.querySelector('button');
const result = document.querySelector('#result');
const error = document.querySelector('#error');
const fallback = 'Unable to create a short URL. Please try again.';
function validLink(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || value.trim() !== value) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === location.origin && !url.username && !url.password && url.pathname.startsWith('/s/') && url.pathname.length > 3; } catch { return false; }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  result.replaceChildren(); error.textContent = ''; error.hidden = true;
  button.disabled = true; form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationUrl: form.elements.destinationUrl.value }) });
    const data = await response.json();
    if (response.status !== 201 || !validLink(data?.shortUrl)) {
      const message = data?.error;
      throw new Error(response.status >= 400 && typeof message?.code === 'string' && typeof message?.message === 'string' && message.message.trim() ? message.message : fallback);
    }
    const link = document.createElement('a'); link.textContent = data.shortUrl; link.setAttribute('href', data.shortUrl); result.append(link);
  } catch (failure) { error.textContent = failure instanceof SyntaxError || failure instanceof TypeError ? fallback : failure.message || fallback; error.hidden = false; }
  finally { button.disabled = false; form.removeAttribute('aria-busy'); }
});
