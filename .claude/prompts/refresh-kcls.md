# Refresh KCLS Tokens

Refresh the KCLS library auth tokens in the book-recos project.

1. Use Playwriter MCP to extract `bc_access_token` and `session_id` cookies from Chrome on any `bibliocommons.com` page:
```js
const cdp = await getCDPSession({ page: state.page });
const { cookies } = await cdp.send('Network.getCookies', {
  urls: ['https://kcls.bibliocommons.com', 'https://gateway.bibliocommons.com']
});
const token = cookies.find(c => c.name === 'bc_access_token');
const session = cookies.find(c => c.name === 'session_id');
console.log('TOKEN:' + token.value);
console.log('SESSION:' + session.value);
```

2. Update `~/Desktop/book-recos/.env` with:
```
KCLS_ACCESS_TOKEN=<token value>
KCLS_SESSION_ID=<session value>
```

3. Verify by running: `bun kcls.ts search "test"`

If the user isn't logged in or Playwriter isn't enabled, ask them to:
- Open Chrome to kcls.bibliocommons.com and log in
- Click the Playwriter extension icon on that tab
