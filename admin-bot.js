const { Telegraf, Markup } = require('telegraf');
const db = require('./supabase-db');
require('dotenv').config();

const token = process.env.ADMIN_BOT_TOKEN;
const adminIds = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000/admin.html';

if (!token) {
  console.error('Missing ADMIN_BOT_TOKEN in environment');
  process.exit(1);
}

const bot = new Telegraf(token);

function isAdmin(ctx) {
  return ctx.from && adminIds.includes(String(ctx.from.id));
}

bot.use(async (ctx, next) => {
  if (!isAdmin(ctx)) {
    await ctx.reply('Access denied. This bot is reserved for Nuibe administrators.');
    return;
  }
  return next();
});

function getAdminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url('Open admin dashboard', adminUrl)],
  ]);
}

bot.start(async (ctx) => {
  await ctx.reply('Nuibe admin bot is online. Use /orders to see recent orders or /help for available commands.', getAdminKeyboard());
});

bot.help(async (ctx) => {
  await ctx.reply(
    'Admin commands:\n' +
    '/orders - List recent orders\n' +
    '/order <id> - Show order details\n' +
    '/status <id> <status> - Update order status\n' +
    '/dashboard - Open the admin dashboard',
    getAdminKeyboard()
  );
});

bot.command('dashboard', async (ctx) => {
  await ctx.reply('Open the admin dashboard:', getAdminKeyboard());
});

bot.command('orders', async (ctx) => {
  const orders = await db.getAllOrders();
  if (!orders.length) return ctx.reply('No orders found.');

  const list = orders.slice(0, 10).map((order) => {
    const name = order.customer_name || 'Unknown';
    return `#${order.id} — ${order.status} — ${order.total}$ — ${name}`;
  }).join('\n');

  await ctx.reply(`Recent orders:\n${list}`);
});

bot.command('order', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const id = args[0];
  if (!id) return ctx.reply('Usage: /order <order_id>');

  const order = await db.getOrderById(id);
  if (!order) return ctx.reply(`Order not found: ${id}`);

  const lines = (order.items || []).map((item) => `- ${item.title} x${item.qty} · ${item.price}$`).join('\n');
  const text = `Order #${order.id}\nStatus: ${order.status}\nName: ${order.customer_name || '-'}\nPhone: ${order.customer_phone || '-'}\nAddress: ${order.customer_address || '-'}\nDelivery: ${order.delivery_time || '-'}\nTelegram: ${order.telegram_username || order.telegram_id || '-'}\nTotal: ${order.total}$\nNotes: ${order.notes || '-'}\nItems:\n${lines || '-'}\n`;
  await ctx.reply(text);
});

bot.command('status', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  const id = parts[0];
  const status = parts.slice(1).join(' ');
  if (!id || !status) return ctx.reply('Usage: /status <order_id> <new_status>');

  const updated = await db.updateOrderStatus(id, status);
  if (!updated) return ctx.reply(`Order not found: ${id}`);
  await ctx.reply(`Order #${id} status updated to ${status}.`);
});

bot.launch().then(async () => {
  console.log('Admin bot is running');
  try {
    const me = await bot.telegram.getMe();
    console.log('Admin bot username:', me.username ? `@${me.username}` : '(unknown)');
  } catch (err) {
    console.warn('Failed to fetch admin bot info:', err && err.message);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
