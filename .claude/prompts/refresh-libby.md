# Refresh Libby Token

Refresh the Libby (OverDrive) bearer token in the book-recos project.

1. Use Playwriter MCP to find the Libby tab and extract the bearer token:
```js
state.page = context.pages().find(p => p.url().includes('libbyapp'));
// Navigate to trigger an API call
await state.page.goto('https://libbyapp.com/shelf', { waitUntil: 'domcontentloaded' });
await state.page.waitForTimeout(3000);
// Extract from sentry cookie/request
const cdp = await getCDPSession({ page: state.page });
const { cookies } = await cdp.send('Network.getCookies', {
  urls: ['https://sentry.libbyapp.com']
});
// The bearer token is in the __cfduid or passed as Authorization header
// Alternative: intercept a sentry request
```

2. If cookie extraction doesn't work, intercept a network request:
```js
let token = null;
state.page.on('request', req => {
  if (req.url().includes('sentry.libbyapp.com') && req.headers()['authorization']) {
    token = req.headers()['authorization'].replace('Bearer ', '');
  }
});
await state.page.goto('https://libbyapp.com/shelf', { waitUntil: 'domcontentloaded' });
await state.page.waitForTimeout(3000);
console.log('TOKEN:' + token);
```

3. Update `~/Desktop/book-recos/.env` with:
```
LIBBY_BEARER_TOKEN=<token value without "Bearer " prefix>
```

4. Verify by running: `bun libby.ts status`

If the user isn't logged in, ask them to open libbyapp.com and log in.
