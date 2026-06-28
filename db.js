const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'nuibe.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

function serializeArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function deserializeArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addColumnIfMissing(table, columnSql) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`).run();
  } catch (err) {
    if (!/duplicate column/i.test(err.message) && !/already exists/i.test(err.message)) {
      throw err;
    }
  }
}

function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS admins (
      telegram_id TEXT PRIMARY KEY,
      name TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      detail TEXT,
      image TEXT,
      model TEXT,
      gallery TEXT,
      featured TEXT,
      tags TEXT,
      actives TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lang TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      telegram_id TEXT,
      telegram_username TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      delivery_time TEXT,
      notes TEXT,
      created_at INTEGER,
      total REAL,
      status TEXT,
      items TEXT
    );
  `);

  addColumnIfMissing('orders', 'telegram_username TEXT');
  addColumnIfMissing('orders', 'customer_name TEXT');
  addColumnIfMissing('orders', 'customer_phone TEXT');
  addColumnIfMissing('orders', 'customer_address TEXT');
  addColumnIfMissing('orders', 'delivery_time TEXT');
  addColumnIfMissing('orders', 'notes TEXT');

  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  if (adminCount === 0) {
    const adminIds = (process.env.ADMIN_IDS || '123456').split(',').map((id) => id.trim()).filter(Boolean);
    const insert = db.prepare('INSERT OR REPLACE INTO admins (telegram_id, name, created_at) VALUES (?, ?, ?)');
    const now = Date.now();
    adminIds.forEach((id) => insert.run(id, 'Admin', now));
  }

  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (productCount === 0) {
    const products = require('./seed-products');
    const insert = db.prepare(`INSERT INTO products (id,title,price,category,detail,image,model,gallery,featured,tags,actives,description,updated_at)
      VALUES (@id,@title,@price,@category,@detail,@image,@model,@gallery,@featured,@tags,@actives,@description,@updated_at)`);
    const now = Date.now();
    const transaction = db.transaction((items) => {
      items.forEach((item) => insert.run({
        id: item.id,
        title: item.title || '',
        price: item.price || 0,
        category: item.category || '',
        detail: item.detail || '',
        image: item.image || '',
        model: item.model || '',
        gallery: JSON.stringify(item.gallery || []),
        featured: item.featured || '',
        tags: JSON.stringify(item.tags || []),
        actives: JSON.stringify(item.actives || []),
        description: item.description || '',
        updated_at: now,
      }));
    });
    transaction(products);
  }

  const faqCount = db.prepare('SELECT COUNT(*) AS count FROM faqs').get().count;
  if (faqCount === 0) {
    const faqs = require('./seed-faqs');
    const insert = db.prepare('INSERT INTO faqs (lang, question, answer, category) VALUES (?, ?, ?, ?)');
    const transaction = db.transaction((items) => {
      items.forEach((item) => insert.run(item.lang, item.question, item.answer, item.category || 'general'));
    });
    transaction(faqs);
  }
}

ensureSchema();

function getProducts() {
  return db.prepare('SELECT * FROM products ORDER BY sort_order ASC, title ASC').all().map((row) => ({
    ...row,
    gallery: deserializeArray(row.gallery),
    tags: deserializeArray(row.tags),
    actives: deserializeArray(row.actives),
  }));
}

function getProductById(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    gallery: deserializeArray(row.gallery),
    tags: deserializeArray(row.tags),
    actives: deserializeArray(row.actives),
  };
}

function getFaqs(lang = 'en') {
  return db.prepare('SELECT question AS q, answer AS a FROM faqs WHERE lang = ? ORDER BY id ASC').all(lang);
}

function getOrdersByTelegramId(telegramId) {
  return db.prepare('SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC').all(telegramId).map((row) => ({
    ...row,
    items: deserializeArray(row.items),
  }));
}

function getOrderById(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, items: deserializeArray(row.items) };
}

function createOrder(order) {
  const stmt = db.prepare('INSERT INTO orders (id, telegram_id, telegram_username, customer_name, customer_phone, customer_address, delivery_time, notes, created_at, total, status, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(
    order.id,
    order.telegram_id,
    order.telegram_username || null,
    order.customer_name || null,
    order.customer_phone || null,
    order.customer_address || null,
    order.delivery_time || null,
    order.notes || null,
    order.created_at,
    order.total,
    order.status || 'processing',
    JSON.stringify(order.items || [])
  );
  return getOrderById(order.id);
}

function updateOrderStatus(id, status) {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  return getOrderById(id);
}

function createProduct(product) {
  const now = Date.now();
  db.prepare(`INSERT INTO products (id,title,price,category,detail,image,model,gallery,featured,tags,actives,description,sort_order,updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(product.id, product.title, product.price, product.category, product.detail, product.image || '', product.model || '', JSON.stringify(product.gallery || []), product.featured || '', JSON.stringify(product.tags || []), JSON.stringify(product.actives || []), product.description || '', product.sort_order || 0, now);
  return getProductById(product.id);
}

function updateProduct(id, fields) {
  const current = getProductById(id);
  if (!current) return null;
  const updated = {
    ...current,
    ...fields,
    gallery: fields.gallery ? JSON.stringify(fields.gallery) : JSON.stringify(current.gallery),
    tags: fields.tags ? JSON.stringify(fields.tags) : JSON.stringify(current.tags),
    actives: fields.actives ? JSON.stringify(fields.actives) : JSON.stringify(current.actives),
    sort_order: fields.sort_order != null ? fields.sort_order : current.sort_order,
    updated_at: Date.now(),
  };
  db.prepare(`UPDATE products SET title = ?, price = ?, category = ?, detail = ?, image = ?, model = ?, gallery = ?, featured = ?, tags = ?, actives = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?`)
    .run(updated.title, updated.price, updated.category, updated.detail, updated.image, updated.model, updated.gallery, updated.featured, updated.tags, updated.actives, updated.description, updated.sort_order, updated.updated_at, id);
  return getProductById(id);
}

function deleteProduct(id) {
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

function getAllOrders() {
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map((row) => ({
    ...row,
    items: deserializeArray(row.items),
  }));
}

function isAdminId(telegramId) {
  if (!telegramId) return false;
  const row = db.prepare('SELECT telegram_id FROM admins WHERE telegram_id = ?').get(String(telegramId));
  return !!row;
}

module.exports = {
  getProducts,
  getProductById,
  getFaqs,
  getOrdersByTelegramId,
  getAllOrders,
  createOrder,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct,
  isAdminId,
};
