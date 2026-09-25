const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('path');
const url = require('url');

// Local Vite dev middleware to emulate Netlify functions during "npm run dev"
function netlifyFunctionsDevPlugin() {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        let functionName = null;
        if (pathname.startsWith('/.netlify/functions/')) {
          functionName = pathname.replace('/.netlify/functions/', '').split('/')[0];
        } else if (pathname.startsWith('/api/')) {
          functionName = pathname.replace('/api/', '').split('/')[0];
        }

        if (!functionName) {
          return next();
        }

        try {
          const fnPath = path.resolve(__dirname, `netlify/functions/${functionName}.js`);
          // Clear require cache for live hot-reloading of backend functions
          delete require.cache[require.resolve(fnPath)];
          const { handler } = require(fnPath);

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            const event = {
              httpMethod: req.method,
              headers: req.headers,
              queryStringParameters: parsedUrl.query,
              body: body || null,
              path: pathname,
            };

            const context = {
              clientContext: {},
            };

            try {
              const response = await handler(event, context);
              res.statusCode = response.statusCode || 200;
              if (response.headers) {
                for (const [key, value] of Object.entries(response.headers)) {
                  res.setHeader(key, value);
                }
              }
              res.end(response.body || '');
            } catch (err) {
              console.error('Function execution error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: err.message }));
            }
          });
        } catch (err) {
          console.warn(`Function not found: ${functionName}`, err.message);
          return next();
        }
      });
    },
  };
}

module.exports = defineConfig({
  plugins: [
    react(),
    netlifyFunctionsDevPlugin(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
