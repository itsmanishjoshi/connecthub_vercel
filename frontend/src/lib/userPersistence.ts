import { supabase } from '@/lib/supabaseClient';

export function getAuthUserId(): string | null {
  if (!localStorage.getItem('connecthub_token')) return null;
  return localStorage.getItem('current_user_id');
}

export async function loadUserRows<T extends Record<string, unknown>>(
  table: string,
  order?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const userId = getAuthUserId();
  if (!userId) return [];

  let query = supabase.from(table).select('*').eq('user_id', userId);
  if (order) {
    query = query.order(order.column, { ascending: order.ascending !== false });
  }

  const { data, error } = await query;
  if (error) {
    console.warn(`Could not load ${table}:`, error.message);
    return [];
  }
  return (data || []) as T[];
}

export async function upsertUserRow(
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId) return;

  const { error } = await supabase.from(table).upsert(
    { ...row, user_id: userId },
    { onConflict },
  );
  if (error) console.warn(`Could not upsert ${table}:`, error.message);
}

export async function deleteUserRows(
  table: string,
  column: string,
  values: string[],
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !values.length) return;

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId)
    .in(column, values);
  if (error) console.warn(`Could not delete from ${table}:`, error.message);
}

export async function replaceUserRows(
  table: string,
  rows: Record<string, unknown>[],
  idColumn = 'id',
): Promise<void> {
  const userId = getAuthUserId();
  if (!userId) return;

  const existing = await loadUserRows<Record<string, unknown>>(table);
  const nextIds = new Set(rows.map((row) => String(row[idColumn])));
  const staleIds = existing
    .map((row) => String(row[idColumn]))
    .filter((id) => !nextIds.has(id));

  if (staleIds.length) {
    await deleteUserRows(table, idColumn, staleIds);
  }

  for (const row of rows) {
    const { error } = await supabase.from(table).upsert(
      { ...row, user_id: userId },
      { onConflict: idColumn },
    );
    if (error) console.warn(`Could not save ${table} row:`, error.message);
  }
}

export async function loadPipelineWorkspace<T>(): Promise<T | null> {
  const userId = getAuthUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('pipeline_workspace')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.data) return null;
  return data.data as T;
}

export async function savePipelineWorkspace(data: unknown): Promise<void> {
  await upsertUserRow('pipeline_workspace', {
    data,
    updated_at: new Date().toISOString(),
  }, 'user_id');
}
