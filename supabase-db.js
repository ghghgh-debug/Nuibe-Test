const localDb = require('./db');
const { supabase, supabaseAvailable } = require('./supabase-client');

function parseItems(items) {
  if (!items) return [];
  try { return typeof items === 'string' ? JSON.parse(items) : items; } catch {
    return items;
  }
}

function formatProduct(row) {
  if (!row) return null;
  return {
    ...row,
    gallery: Array.isArray(row.gallery) ? row.gallery : (row.gallery ? JSON.parse(row.gallery || '[]') : []),
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags || '[]') : []),
    actives: Array.isArray(row.actives) ? row.actives : (row.actives ? JSON.parse(row.actives || '[]') : []),
  };
}

async function getProducts() {
  if (!supabaseAvailable) return localDb.getProducts();
  const { data, error } = await supabase.from('products').select('*').order('title', { ascending: true });
  if (error) throw error;
  return data.map(formatProduct);
}

async function getProductById(id) {
  if (!supabaseAvailable) return localDb.getProductById(id);
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116' || error.status === 404) return null;
    throw error;
  }
  return formatProduct(data);
}

async function getFaqs(lang = 'en') {
  if (!supabaseAvailable) return localDb.getFaqs(lang);
  const { data, error } = await supabase.from('faqs').select('question,answer').eq('lang', lang).order('id', { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ q: row.question, a: row.answer }));
}

async function getOrdersByTelegramId(telegramId) {
  if (!supabaseAvailable) return localDb.getOrdersByTelegramId(telegramId);
  const { data, error } = await supabase.from('orders').select('*').eq('telegram_id', telegramId).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ ...row, items: parseItems(row.items) }));
}

async function getAllOrders() {
  if (!supabaseAvailable) return localDb.getAllOrders();
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ ...row, items: parseItems(row.items) }));
}

async function createOrder(order) {
  if (!supabaseAvailable) return localDb.createOrder(order);
  const { data, error } = await supabase
    .from('orders')
    .insert([{ id: order.id, telegram_id: order.telegram_id, created_at: order.created_at, total: order.total, status: order.status || 'processing', items: JSON.stringify(order.items || []) }]);
  if (error) throw error;
  return { ...data[0], items: order.items };
}

async function updateOrderStatus(id, status) {
  if (!supabaseAvailable) return localDb.updateOrderStatus(id, status);
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select('*').single();
  if (error) throw error;
  return { ...data, items: parseItems(data.items) };
}

async function createProduct(product) {
  if (!supabaseAvailable) return localDb.createProduct(product);
  const { data, error } = await supabase.from('products').insert([{
    id: product.id,
    title: product.title,
    price: product.price,
    category: product.category,
    detail: product.detail,
    image: product.image || '',
    model: product.model || '',
    gallery: product.gallery || [],
    featured: product.featured || '',
    tags: product.tags || [],
    actives: product.actives || [],
    description: product.description || '',
  }]).select('*').single();
  if (error) throw error;
  return formatProduct(data);
}

async function updateProduct(id, fields) {
  if (!supabaseAvailable) return localDb.updateProduct(id, fields);
  const updateFields = {
    ...fields,
    gallery: fields.gallery || undefined,
    tags: fields.tags || undefined,
    actives: fields.actives || undefined,
  };
  const { data, error } = await supabase.from('products').update(updateFields).eq('id', id).select('*').single();
  if (error) throw error;
  return formatProduct(data);
}

async function deleteProduct(id) {
  if (!supabaseAvailable) return localDb.deleteProduct(id);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

async function isAdminId(telegramId) {
  if (!supabaseAvailable) return localDb.isAdminId(telegramId);
  const { data, error } = await supabase.from('admins').select('telegram_id').eq('telegram_id', telegramId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
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
