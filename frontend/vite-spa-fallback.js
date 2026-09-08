// SPA fallback middleware for Vite preview server
export default function spaFallback() {
  return {
    name: 'spa-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        // If the request is for a file that doesn't exist and doesn't have an extension,
        // serve index.html instead
        if (
          req.url &&
          !req.url.includes('.') &&
          !req.url.startsWith('/api') &&
          req.headers.accept?.includes('text/html')
        ) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}
