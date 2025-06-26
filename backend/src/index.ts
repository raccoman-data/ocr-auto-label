import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@prisma/client';

// Load environment variables from .env file
dotenv.config();

// Import routes
import imageRoutes from './routes/images';
import uploadRoutes from './routes/upload';

// Initialize Prisma client
export const prisma = new PrismaClient();

// Use OS temp directory + app-specific folder to avoid bloating codebase
const TEMP_DIR = path.join(os.tmpdir(), 'ocr-auto-label');
const UPLOADS_DIR = path.join(TEMP_DIR, 'uploads');
const THUMBNAILS_DIR = path.join(TEMP_DIR, 'thumbnails');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware with updated CSP for images
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3001", "http://127.0.0.1:3001"], // Allow images from backend
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Compression middleware - exclude images to preserve quality
app.use(compression({
  filter: (req, res) => {
    // Disable compression for SSE to avoid buffering
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      return false;
    }

    // Don't compress images (quality preservation)
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/thumbnails/')) {
      return false;
    }

    // Default behavior for everything else
    return compression.filter(req, res);
  }
}));

// CORS configuration for local development
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for thumbnails and cached images with CORS headers
app.use('/thumbnails', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(THUMBNAILS_DIR));

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(UPLOADS_DIR));

// Raw image serving route - completely bypasses any middleware processing
app.get('/raw/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);
  
  // Set headers to prevent any compression or processing
  res.set({
    'Cache-Control': 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'image/jpeg', // Will be overridden by sendFile if different
  });
  
  // Send file directly without any processing
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving raw image:', err);
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

// API routes
app.use('/api/images', imageRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Files stored in: ${TEMP_DIR}`);
  console.log(`💡 Tip: Files are stored in temp directory and will be cleaned up on system restart`);
});

// Add cleanup function for development
export function cleanupTempFiles() {
  console.log(`🧹 Cleaning up temp files in: ${TEMP_DIR}`);
  // This will be called on graceful shutdown
}