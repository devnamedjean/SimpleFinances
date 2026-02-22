import { Handler } from '@netlify/functions';
import https from 'https';
import { Buffer } from 'buffer';

export const handler: Handler = async (event) => {
  const targetUrl = process.env.VITE_SIMPLEFIN_ACCESS_URL || event.headers['x-simplefin-url'];

  if (!targetUrl || typeof targetUrl !== 'string') {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No SimpleFIN access URL provided' }),
    };
  }

  try {
    let cleanUrl = targetUrl;
    if (!cleanUrl.endsWith('/accounts') && !cleanUrl.endsWith('/accounts/')) {
      cleanUrl = cleanUrl.endsWith('/') ? cleanUrl + 'accounts' : cleanUrl + '/accounts';
    }

    const urlObj = new URL(cleanUrl);
    
    // Forward query parameters
    if (event.queryStringParameters) {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        if (value) urlObj.searchParams.set(key, value);
      });
    }

    const username = decodeURIComponent(urlObj.username);
    const password = decodeURIComponent(urlObj.password);
    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    return new Promise((resolve) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Authorization': auth,
          'Accept': 'application/json',
          'User-Agent': 'NetlifyFunction/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            headers: { 'Content-Type': 'application/json' },
            body: rawData,
          });
        });
      });

      req.on('error', (e) => {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: e.message }),
        });
      });

      req.end();
    });
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
