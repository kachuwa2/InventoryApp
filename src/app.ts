import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from .env file
// Must be called before anything that uses process.env
dotenv.config();

const app = express();

// Tells Express to parse incoming JSON request bodies
// Without this, req.body would be undefined
app.use(express.json());

// Lets Express read cookies from incoming requests
// Needed for the refresh token cookie
app.use(cookieParser());

// Health check endpoint
// Always useful to verify the server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Routes will be added here as we build each module

// Error handler MUST be the last middleware registered
// Express identifies it by its four parameters

app.use(errorHandler);

export default app;