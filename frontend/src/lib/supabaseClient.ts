import { createLocalDbClient } from './localDbClient';

/** Local Express + PostgreSQL client. The name is historical. */
export const supabase = createLocalDbClient();
