# Refresh Goodreads Tokens

Refresh the Goodreads auth tokens in the book-recos project.

1. Use Playwriter MCP to find or navigate to a Goodreads page:
```js
state.page = context.pages().find(p => p.url().includes('goodreads'))
  ?? (await context.newPage());
if (!state.page.url().includes('goodreads')) {
  await state.page.goto('https://www.goodreads.com/', { waitUntil: 'domcontentloaded' });
  await waitForPageLoad({ page: state.page, timeout: 5000 });
}
```

2. Extract CSRF token from the page:
```js
const csrf = await state.page.evaluate(() => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
});
console.log('CSRF:' + csrf);
```

3. Extract cookies via CDP:
```js
const cdp = await getCDPSession({ page: state.page });
const { cookies } = await cdp.send('Network.getCookies', {
  urls: ['https://www.goodreads.com']
});
const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
console.log('COOKIE:' + cookieStr);
```

4. Update `~/Desktop/book-recos/.env` with:
```
GOODREADS_CSRF=<csrf value>
GOODREADS_COOKIE=<cookie string>
```

5. Verify by running: `bun goodreads.ts shelves`

If the user isn't logged in, ask them to log in at goodreads.com first.
