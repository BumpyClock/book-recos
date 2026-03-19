# Refresh StoryGraph Tokens

Refresh the StoryGraph auth tokens in the book-recos project.

1. Use Playwriter MCP to find or navigate to StoryGraph:
```js
state.page = context.pages().find(p => p.url().includes('thestorygraph'))
  ?? (await context.newPage());
if (!state.page.url().includes('thestorygraph')) {
  await state.page.goto('https://app.thestorygraph.com/', { waitUntil: 'domcontentloaded' });
  await waitForPageLoad({ page: state.page, timeout: 5000 });
}
```

2. Extract CSRF token:
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
  urls: ['https://app.thestorygraph.com']
});
const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
console.log('COOKIE:' + cookieStr);
```

4. Update `~/Desktop/book-recos/.env` with:
```
STORYGRAPH_CSRF=<csrf value>
STORYGRAPH_COOKIE=<cookie string>
```

5. Verify by running: `bun storygraph.ts search "test"`

If the user isn't logged in, ask them to log in at app.thestorygraph.com first.
