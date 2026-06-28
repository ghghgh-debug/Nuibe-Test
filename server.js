const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./supabase-db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function getTelegramId(req) {
  return req.headers['x-telegram-id'] || req.query.telegramId || req.body.telegramId || null;
}

async function requireAdmin(req, res, next) {
  const telegramId = getTelegramId(req);
  if (!telegramId) {
    return res.status(401).json({ error: 'Telegram id is required for admin access' });
  }
  const isAdmin = await db.isAdminId(telegramId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  req.telegramId = telegramId;
  next();
}

app.get('/api/products', async (req, res) => {
  const products = await db.getProducts();
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.get('/api/faqs', async (req, res) => {
  const lang = req.query.lang || 'en';
  const faqs = await db.getFaqs(lang);
  res.json(faqs);
});

app.get('/api/user', async (req, res) => {
  const telegramId = getTelegramId(req);
  const isAdmin = telegramId ? await db.isAdminId(telegramId) : false;
  res.json({ telegramId, isAdmin });
});

app.get('/api/orders', async (req, res) => {
  const telegramId = getTelegramId(req);
  if (!telegramId) return res.status(400).json({ error: 'Telegram id is required' });
  const isAdmin = await db.isAdminId(telegramId);
  if (isAdmin && req.query.all === '1') {
    return res.json(await db.getAllOrders());
  }
  res.json(await db.getOrdersByTelegramId(telegramId));
});

app.post('/api/orders', async (req, res) => {
  const payload = req.body;
  if (!payload.telegramId || !Array.isArray(payload.items) || payload.items.length === 0) {
    return res.status(400).json({ error: 'telegramId and items are required' });
  }
  const order = {
    id: payload.id || `NB${Date.now().toString().slice(-6)}`,
    telegram_id: payload.telegramId,
    created_at: Date.now(),
    total: payload.total || 0,
    status: payload.status || 'processing',
    items: payload.items,
  };
  const saved = await db.createOrder(order);
  res.json(saved);
});

app.get('/api/admin/check', async (req, res) => {
  const telegramId = getTelegramId(req);
  const isAdmin = telegramId ? await db.isAdminId(telegramId) : false;
  res.json({ telegramId, isAdmin });
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  res.json(await db.getProducts());
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const product = req.body;
  if (!product || !product.id || !product.title || typeof product.price !== 'number') {
    return res.status(400).json({ error: 'Product id, title and price are required' });
  }
  const created = await db.createProduct(product);
  res.json(created);
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const updated = await db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  await db.deleteProduct(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  res.json(await db.getAllOrders());
});

app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const updated = await db.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
});

app.listen(port, () => {
  console.log(`Nuibe backend running on http://localhost:${port}`);
});
