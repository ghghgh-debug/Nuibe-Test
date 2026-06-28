const { Telegraf, Markup } = require('telegraf');
const db = require('./supabase-db');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN in environment');
  process.exit(1);
}

const bot = new Telegraf(token);

async function isAdmin(userId) {
  return await db.isAdminId(String(userId));
}

bot.start(async (ctx) => {
  const greeting = `Welcome to nuibe Bot!\n\nYou can browse product info, review FAQs, and track your order status.`;
  await ctx.reply(greeting, Markup.keyboard([
    ['🛍️ Products', '❓ FAQ'],
    ['📦 My Orders', '👤 Admin panel']
  ]).resize());
});

bot.hears('🛍️ Products', async (ctx) => {
  const products = (await db.getProducts()).slice(0, 5);
  const items = products.map((product) => `${product.title} — ${product.price}$\n${product.detail}`).join('\n\n');
  await ctx.reply(`Latest products:\n\n${items}\n\nOpen the mini app to shop or visit the web app.`);
});

bot.hears('❓ FAQ', async (ctx) => {
  const faqs = (await db.getFaqs('en')).slice(0, 4);
  const buttons = faqs.map((faq, index) => [Markup.button.callback(faq.question, `faq_${index}`)]);
  await ctx.reply('Choose a question:', Markup.inlineKeyboard(buttons));
});

bot.action(/faq_(\d+)/, async (ctx) => {
  const index = Number(ctx.match[1]);
  const faqs = await db.getFaqs('en');
  if (!faqs[index]) return ctx.answerCbQuery('Question not found');
  await ctx.reply(`Q: ${faqs[index].q || faqs[index].question}\nA: ${faqs[index].a || faqs[index].answer}`);
});

bot.hears('📦 My Orders', async (ctx) => {
  const userId = String(ctx.from.id);
  const orders = await db.getOrdersByTelegramId(userId);
  if (!orders.length) return ctx.reply('You have no orders yet. Open the mini app to shop and place your first order.');
  const list = orders.map((order) => `#${order.id} — ${order.status}\n${(order.items || []).length} item(s) • ${order.total}$`).join('\n\n');
  await ctx.reply(`Your recent orders:\n\n${list}`);
});

bot.hears('👤 Admin panel', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) {
    return ctx.reply('Access denied. This section is for admin accounts only.');
  }
  await ctx.reply('Admin commands: /admin_orders, /admin_link');
});

bot.command('admin_orders', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('Admin access required.');
  const orders = await db.getAllOrders();
  if (!orders.length) return ctx.reply('There are no orders yet.');
  const first = orders.slice(0, 5).map((order) => `#${order.id} — ${order.status}\n${(order.items || []).length} item(s) • ${order.total}$`).join('\n\n');
  await ctx.reply(`Recent orders:\n\n${first}`);
});

bot.command('admin_link', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('Admin access required.');
  const baseUrl = process.env.ADMIN_URL || 'http://localhost:3000/admin.html';
  await ctx.reply(`Open the admin dashboard:\n${baseUrl}?telegram_id=${ctx.from.id}`);
});

bot.command('help', async (ctx) => {
  await ctx.reply('Use the buttons or commands:\n/faq — Frequently asked questions\n/products — Browse latest items\n/orders — Your order status\n/admin_orders — Admin only\n/admin_link — Admin panel link');
});

bot.launch().then(() => {
  console.log('Telegram bot is running');
  (async () => {
    try {
      const me = await bot.telegram.getMe();
      const botLink = `https://t.me/${me.username}`;
      const webUrl = process.env.WEB_APP_URL || process.env.ADMIN_URL || 'https://nuibe-test.onrender.com';
      console.log('Bot URL:', botLink);
      console.log('Web app URL:', webUrl);

      const adminIds = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (adminIds.length) {
        const text = `Web app is live: ${webUrl}\nOpen in Telegram: ${botLink}`;
        for (const id of adminIds) {
          try {
            await bot.telegram.sendMessage(id, text);
          } catch (err) {
            console.warn('Failed to notify admin', id, err && err.message);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch bot info or notify admins:', err && err.message);
    }
  })();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
