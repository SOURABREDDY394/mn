import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleWalletProvider } from './providers/google-wallet/google-wallet.provider.js';
import { PassService } from './services/pass.service.js';
import { PassController } from './controllers/pass.controller.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend assets
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Initialize Providers & Service
const googleWalletProvider = new GoogleWalletProvider();
const passService = new PassService(googleWalletProvider);

// Controller
const passController = new PassController(passService, googleWalletProvider);

// Routes
// 1. Pass Creation
app.post('/api/passes', passController.createPass);

// 2. Pass Update (Exact requirement: POST /passes/:id and alias /api/passes/:id)
app.post('/passes/:id', passController.updatePass);
app.post('/api/passes/:id', passController.updatePass);

// 3. Pass Retrieval & Status
app.get('/api/passes/:id', passController.getPass);
app.get('/api/status', passController.getStatus);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'ok' });
});

// Fallback to index.html for SPA frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Google Wallet Pass Issuer Server running on:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`======================================================`);

  try {
    await passService.initialize();
  } catch (err) {
    console.warn('Initialization note:', (err as Error).message);
  }

  console.log(`\nReady to accept requests:`);
  console.log(`- Web UI:       http://localhost:${PORT}`);
  console.log(`- Create Pass:  POST http://localhost:${PORT}/api/passes`);
  console.log(`- Update Pass:  POST http://localhost:${PORT}/passes/:id`);
  console.log(`- Healthcheck:  GET  http://localhost:${PORT}/api/status\n`);
});
