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

function getWebAppUrl() {
  return process.env.WEB_APP_URL || process.env.ADMIN_URL || 'https://nuibe-test.onrender.com';
}

function getMainKeyboard() {
  return Markup.keyboard([
    ['🛍️ Shop', '❓ FAQ'],
    ['📦 My Orders', '👤 Admin panel']
  ]).resize();
}

function getShopButton() {
  const url = getWebAppUrl();
  return Markup.inlineKeyboard([[{
    text: 'Open Shop',
    web_app: { url },
  }]]);
}

bot.start(async (ctx) => {
  const greeting = `Welcome to Nuibe!\n\nI can help you browse products, answer FAQs, and show your orders.`;
  await ctx.reply(greeting, getMainKeyboard());
  await ctx.reply('Open the mini app in Telegram:', getShopButton());
});

bot.command('shop', async (ctx) => {
  await ctx.reply('Open the mini app in Telegram:', getShopButton());
});

bot.command('products', async (ctx) => {
  const products = (await db.getProducts()).slice(0, 5);
  if (!products.length) return ctx.reply('No products available right now.');
  const items = products.map((product) => `${product.title} — ${product.price}$\n${product.detail}`).join('\n\n');
  await ctx.reply(`Latest products:\n\n${items}`);
});

bot.command('faq', async (ctx) => {
  const faqs = (await db.getFaqs('en')).slice(0, 4);
  if (!faqs.length) return ctx.reply('No FAQ available yet.');
  const buttons = faqs.map((faq, index) => [Markup.button.callback(faq.question, `faq_${index}`)]);
  await ctx.reply('Choose a question:', Markup.inlineKeyboard(buttons));
});

bot.command('orders', async (ctx) => {
  const userId = String(ctx.from.id);
  const orders = await db.getOrdersByTelegramId(userId);
  if (!orders.length) return ctx.reply('You have no orders yet. Open the mini app to shop and place your first order.');
  const list = orders.map((order) => `#${order.id} — ${order.status}\n${(order.items || []).length} item(s) • ${order.total}$`).join('\n\n');
  await ctx.reply(`Your recent orders:\n\n${list}`);
});

bot.hears('🛍️ Shop', async (ctx) => {
  await ctx.reply('Open the mini app in Telegram:', getShopButton());
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

bot.command('help', async (ctx) => {
  await ctx.reply('Use the buttons or commands:\n/start — Start the bot\n/shop — Open the mini app\n/products — Browse latest items\n/faq — Frequently asked questions\n/orders — Your order status\n/admin_orders — Admin only\n/admin_link — Admin panel link', getMainKeyboard());
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
