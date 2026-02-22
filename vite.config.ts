import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'
import { Buffer } from 'buffer'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'simplefin-api-proxy',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/accounts') && req.method === 'GET') {
              const targetUrl = env.VITE_SIMPLEFIN_ACCESS_URL || (req.headers['x-simplefin-url'] as string);

              if (!targetUrl || typeof targetUrl !== 'string') {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'No SimpleFIN access URL provided' }));
                return;
              }

              try {
                let cleanUrl = targetUrl;
                if (!cleanUrl.endsWith('/accounts') && !cleanUrl.endsWith('/accounts/')) {
                  cleanUrl = cleanUrl.endsWith('/') ? cleanUrl + 'accounts' : cleanUrl + '/accounts';
                }

                const urlObj = new URL(cleanUrl);
                
                // Forward query parameters
                const incomingUrl = new URL(req.url || '', 'http://localhost');
                incomingUrl.searchParams.forEach((v, k) => urlObj.searchParams.set(k, v));

                const username = decodeURIComponent(urlObj.username);
                const password = decodeURIComponent(urlObj.password);
                const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

                const options = {
                  hostname: urlObj.hostname,
                  port: urlObj.port || 443,
                  path: urlObj.pathname + urlObj.search,
                  method: 'GET',
                  headers: {
                    'Authorization': auth,
                    'Accept': 'application/json',
                    'User-Agent': 'ViteProxy/1.0'
                  }
                };

                const proxyReq = https.request(options, (proxyRes) => {
                  res.statusCode = proxyRes.statusCode || 200;
                  res.setHeader('Content-Type', 'application/json');
                  proxyRes.on('data', (chunk) => res.write(chunk));
                  proxyRes.on('end', () => res.end());
                });

                proxyReq.on('error', (e) => {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                });

                proxyReq.end();
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
              return;
            }

            if (req.url && req.url.startsWith('/api/claim') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  const claimUrl = Buffer.from(data.setupToken, 'base64').toString('utf8');
                  const urlObj = new URL(claimUrl);

                  const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || 443,
                    path: urlObj.pathname + urlObj.search,
                    method: 'POST',
                    headers: { 'Content-Length': 0 }
                  };

                  const proxyReq = https.request(options, (proxyRes) => {
                    let rawData = '';
                    proxyRes.on('data', (chunk) => rawData += chunk);
                    proxyRes.on('end', () => {
                      res.statusCode = proxyRes.statusCode || 200;
                      res.setHeader('Content-Type', 'application/json');
                      if (res.statusCode !== 200) {
                        res.end(JSON.stringify({ error: 'Failed to claim token' }));
                      } else {
                        res.end(JSON.stringify({ accessUrl: rawData }));
                      }
                    });
                  });
                  proxyReq.end();
                } catch (e: any) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            next();
          });
        }
      }
    ]
  }
})
