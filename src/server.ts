import app from './app';

// Read port from .env, fall back to 3000 if not set
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
    Server is running
    URL: http://localhost:${PORT}
    Environment: ${process.env.NODE_ENV}
  `);
});