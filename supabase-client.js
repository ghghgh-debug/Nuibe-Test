const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
	const options = {};
	try {
		const [major] = (process.versions.node || '0').split('.').map(Number);
		if (major && major < 22) {
			// For Node < 22, provide a ws transport for realtime
			try {
				const ws = require('ws');
				options.realtime = { transport: ws };
			} catch (err) {
				// ws not installed — createClient will throw later if needed
				console.warn('`ws` not available; realtime may not work on Node <22');
			}
		}
	} catch (err) {}

	supabase = createClient(SUPABASE_URL, SUPABASE_KEY, options);
}
const supabaseAvailable = !!supabase;

module.exports = { supabase, supabaseAvailable };
