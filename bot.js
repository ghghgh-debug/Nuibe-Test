const { Telegraf, Markup } = require('telegraf');
const db = require('./supabase-db');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN in environment');
  process.exit(1);
}

const bot = new Telegraf(token);

function getWebAppUrl() {
  return process.env.WEB_APP_URL || process.env.ADMIN_URL || 'https://nuibe-test.onrender.com';
}

function getMainKeyboard() {
  return Markup.keyboard([
    ['🛍️ Shop', '❓ FAQ'],
    ['📦 My Orders']
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

bot.command('help', async (ctx) => {
  await ctx.reply('Use the buttons or commands:\n/start — Start the bot\n/shop — Open the mini app\n/products — Browse latest items\n/faq — Frequently asked questions\n/orders — Your order status', getMainKeyboard());
});

async function configureBot() {
  const url = getWebAppUrl();
  const commands = [
    { command: 'start', description: 'Start the Nuibe bot' },
    { command: 'shop', description: 'Open the mini app' },
    { command: 'products', description: 'Browse latest items' },
    { command: 'faq', description: 'Frequently asked questions' },
    { command: 'orders', description: 'Your order status' },
    { command: 'help', description: 'Show help and quick commands' },
  ];

  await bot.telegram.setMyCommands(commands);
  await bot.telegram.setMyDescription({ description: 'Nuibe mini shop inside Telegram — browse products, FAQ, and orders.' });
  await bot.telegram.setMyShortDescription({ short_description: 'Shop, FAQ, orders' });
  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: 'Open Shop',
      web_app: { url },
    },
  });
}

bot.launch().then(() => {
  console.log('Telegram bot is running');
  (async () => {
    try {
      const me = await bot.telegram.getMe();
      const botLink = `https://t.me/${me.username}`;
      const webUrl = getWebAppUrl();
      console.log('Bot URL:', botLink);
      console.log('Web app URL:', webUrl);

      await configureBot();
    } catch (err) {
      console.warn('Failed to fetch bot info:', err && err.message);
    }
  })();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
