// Quick OAuth flow to capture your Shopify Admin API access token
// Usage: node scripts/get-shopify-token.js

const http = require('http');
const https = require('https');
const url = require('url');

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN; // e.g. distinct-ink.myshopify.com
const SCOPES = 'read_products,write_products,read_publications,write_publications';
const REDIRECT_URI = 'http://localhost:3456/callback';

if (!CLIENT_ID || !CLIENT_SECRET || !SHOP) {
  console.error('\nMissing environment variables. Run with:');
  console.error('  SHOPIFY_CLIENT_ID=aaf49fdc221edbbad2ff02697e1ac8cc \\');
  console.error('  SHOPIFY_CLIENT_SECRET=your_secret \\');
  console.error('  NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \\');
  console.error('  node scripts/get-shopify-token.js\n');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/callback' && parsed.query.code) {
    const code = parsed.query.code;

    // Exchange code for access token
    const postData = JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
    });

    const tokenReq = https.request(
      {
        hostname: SHOP,
        path: '/admin/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (tokenRes) => {
        let data = '';
        tokenRes.on('data', (chunk) => (data += chunk));
        tokenRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.access_token) {
              console.log('\n✅ SUCCESS! Your Admin API access token:\n');
              console.log(`  ${result.access_token}\n`);
              console.log('Add this to your .env.local as:');
              console.log(`  SHOPIFY_ADMIN_ACCESS_TOKEN=${result.access_token}\n`);
            } else {
              console.error('\nToken exchange failed:', data);
            }
          } catch (e) {
            console.error('\nFailed to parse response:', data);
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Done! Check your terminal for the access token. You can close this tab.</h1>');
          setTimeout(() => process.exit(0), 1000);
        });
      }
    );

    tokenReq.on('error', (e) => console.error('Request error:', e));
    tokenReq.write(postData);
    tokenReq.end();
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3456, () => {
  const authUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('\n📋 Open this URL in your browser:\n');
  console.log(`  ${authUrl}\n`);
  console.log('Waiting for callback...\n');
});
