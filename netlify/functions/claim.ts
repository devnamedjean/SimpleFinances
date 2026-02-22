import { Handler } from '@netlify/functions';
import https from 'https';
import { Buffer } from 'buffer';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const setupToken = data.setupToken;
    if (!setupToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing setup token' }) };
    }

    const claimUrl = Buffer.from(setupToken, 'base64').toString('utf8');
    const urlObj = new URL(claimUrl);

    return new Promise((resolve) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: { 'Content-Length': 0 }
      };

      const req = https.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({
              statusCode: res.statusCode || 400,
              body: JSON.stringify({ error: 'Failed to claim simplefin token' }),
            });
          } else {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessUrl: rawData }),
            });
          }
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
    return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
  }
};
