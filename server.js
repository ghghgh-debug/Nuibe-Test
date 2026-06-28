const express = require('express');
const path = require('path');
const cors = require('cors');
const { Telegram } = require('telegraf');
const db = require('./supabase-db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const adminTelegram = process.env.ADMIN_BOT_TOKEN ? new Telegram(process.env.ADMIN_BOT_TOKEN) : null;
const adminIds = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

async function notifyAdmins(order) {
  if (!adminTelegram || !adminIds.length) return;

  const orderLines = (order.items || []).map((item) => `- ${item.title} x${item.qty} · ${item.price}$`).join('\n');
  const text = `📦 *New order placed*\n` +
    `*Order ID:* ${order.id}\n` +
    `*Name:* ${order.customer_name || '-'}\n` +
    `*Phone:* ${order.customer_phone || '-'}\n` +
    `*Address:* ${order.customer_address || '-'}\n` +
    `*Delivery:* ${order.delivery_time || '-'}\n` +
    `*Telegram:* ${order.telegram_username || order.telegram_id || '-'}\n` +
    `*Total:* ${order.total}$\n` +
    `*Status:* ${order.status || 'processing'}\n` +
    `*Items:*\n${orderLines || '-'}\n` +
    `*Notes:* ${order.notes || '-'}\n` +
    `\nPlease contact the customer directly and confirm payment details.`;

  for (const id of adminIds) {
    try {
      await adminTelegram.sendMessage(id, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.warn('Failed to notify admin', id, err && err.message);
    }
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function getTelegramId(req) {
  return req.headers['x-telegram-id'] || req.query.telegramId || req.body.telegramId || null;
}

const requireAdmin = asyncHandler(async (req, res, next) => {
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
});

app.get('/api/products', asyncHandler(async (req, res) => {
  const products = await db.getProducts();
  res.json(products);
}));

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = await db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));

app.get('/api/faqs', asyncHandler(async (req, res) => {
  const lang = req.query.lang || 'en';
  const faqs = await db.getFaqs(lang);
  res.json(faqs);
}));

app.get('/api/user', asyncHandler(async (req, res) => {
  const telegramId = getTelegramId(req);
  const isAdmin = telegramId ? await db.isAdminId(telegramId) : false;
  res.json({ telegramId, isAdmin });
}));

app.get('/api/orders', asyncHandler(async (req, res) => {
  const telegramId = getTelegramId(req);
  if (!telegramId) return res.status(400).json({ error: 'Telegram id is required' });
  const isAdmin = await db.isAdminId(telegramId);
  if (isAdmin && req.query.all === '1') {
    return res.json(await db.getAllOrders());
  }
  res.json(await db.getOrdersByTelegramId(telegramId));
}));

app.post('/api/orders', asyncHandler(async (req, res) => {
  const payload = req.body;
  if (!payload.telegramId || !Array.isArray(payload.items) || payload.items.length === 0) {
    return res.status(400).json({ error: 'telegramId and items are required' });
  }
  if (!payload.customer_name || !payload.customer_phone || !payload.customer_address || !payload.delivery_time) {
    return res.status(400).json({ error: 'customer_name, customer_phone, customer_address and delivery_time are required' });
  }
  const order = {
    id: payload.id || `NB${Date.now().toString().slice(-6)}`,
    telegram_id: payload.telegramId,
    telegram_username: payload.telegram_username || null,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    customer_address: payload.customer_address,
    delivery_time: payload.delivery_time,
    notes: payload.notes || '',
    created_at: Date.now(),
    total: payload.total || 0,
    status: payload.status || 'processing',
    items: payload.items,
  };
  const saved = await db.createOrder(order);
  res.json(saved);
  notifyAdmins(saved).catch((err) => console.warn('Failed to send admin notification:', err && err.message));
}));

app.get('/api/admin/check', asyncHandler(async (req, res) => {
  const telegramId = getTelegramId(req);
  const isAdmin = telegramId ? await db.isAdminId(telegramId) : false;
  res.json({ telegramId, isAdmin });
}));

app.get('/api/admin/products', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await db.getProducts());
}));

app.post('/api/admin/products', requireAdmin, asyncHandler(async (req, res) => {
  const product = req.body;
  if (!product || !product.id || !product.title || typeof product.price !== 'number') {
    return res.status(400).json({ error: 'Product id, title and price are required' });
  }
  const created = await db.createProduct(product);
  res.json(created);
}));

app.put('/api/admin/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const updated = await db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
}));

app.delete('/api/admin/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  await db.deleteProduct(req.params.id);
  res.json({ success: true });
}));

app.get('/api/admin/orders', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await db.getAllOrders());
}));

app.put('/api/admin/orders/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const updated = await db.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
}));

// Health check endpoint for uptime monitors
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve the mini app at root if present, otherwise redirect to admin UI
app.get('/', (req, res) => {
  const miniAppPath = path.join(__dirname, 'nuibe Mini App.dc.html');
  const adminPath = path.join(__dirname, 'admin.html');
  try {
    if (require('fs').existsSync(miniAppPath)) return res.sendFile(miniAppPath);
  } catch (e) {}
  if (require('fs').existsSync(adminPath)) return res.redirect('/admin.html');
  res.status(200).send('Nuibe backend is running. Visit /admin.html to manage the app.');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Nuibe backend running on http://localhost:${port}`);
});
