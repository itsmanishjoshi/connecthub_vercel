const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type Filter = { op: 'eq' | 'neq' | 'is' | 'in'; column: string; value: unknown };

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(body: Record<string, unknown>) {
  try {
    const response = await fetch(`${API_BASE}/api/db`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({ data: null, error: { message: 'Invalid API response' } }));
    if (response.status === 401) {
      localStorage.removeItem('connecthub_token');
      localStorage.removeItem('current_user_id');
      localStorage.removeItem('current_username');
      localStorage.removeItem('connecthub_session_snapshot');
      window.dispatchEvent(new CustomEvent('connecthub:session-expired'));
    }
    if (response.status === 409) {
      json.error = {
        ...(json.error || { message: 'A newer version exists on another device' }),
        code: 'CONFLICT',
      };
    }
    if (!response.ok && !json.error) {
      json.error = { message: `API error ${response.status}` };
    }
    return json;
  } catch {
    return { data: null, error: { message: 'Network unavailable', code: 'NETWORK' } };
  }
}

class QueryBuilder {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectColumns = '*';
  private filters: Filter[] = [];
  private orderColumn?: string;
  private ascending = true;
  private singleRow = false;
  private maybeSingleRow = false;
  private payload: unknown;
  private onConflict?: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ op: 'is', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending !== false;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleRow = true;
    return this;
  }

  insert(data: unknown) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data: unknown) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(data: unknown, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = data;
    this.onConflict = options?.onConflict;
    return this;
  }

  then<T>(resolve: (value: { data: T; error: { message: string; code?: string } | null }) => T | PromiseLike<T>, reject?: (reason: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }

  private execute() {
    return request({
      table: this.tableName,
      action: this.action,
      select: this.selectColumns,
      filters: this.filters,
      order: this.orderColumn,
      ascending: this.ascending,
      single: this.singleRow,
      maybeSingle: this.maybeSingleRow,
      data: this.payload,
      onConflict: this.onConflict,
    });
  }
}

function currentUser() {
  const id = localStorage.getItem('current_user_id');
  return id ? { id } : null;
}

function createStorageBucket(bucket: string) {
  return {
    async upload(filePath: string, file: File | Blob, _options?: Record<string, unknown>) {
      const form = new FormData();
      form.append('path', filePath);
      form.append('file', file, (file as File).name || pathBasename(filePath));
      try {
        const response = await fetch(`${API_BASE}/api/storage/${encodeURIComponent(bucket)}`, {
          method: 'POST',
          headers: (() => {
            const token = localStorage.getItem('connecthub_token');
            return token ? { Authorization: `Bearer ${token}` } : {};
          })(),
          body: form,
        });
        const json = await response.json().catch(() => ({ error: { message: 'Upload failed' } }));
        if (!response.ok || json.error) {
          return { data: null, error: json.error || { message: 'Upload failed' } };
        }
        return { data: json.data, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        return {
          data: null,
          error: { message: `${message}. Open ConnectHub at http://localhost:3556 and try again.` },
        };
      }
    },
    async remove(paths: string[]) {
      const response = await fetch(`${API_BASE}/api/storage/${encodeURIComponent(bucket)}/remove`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ paths }),
      });
      const json = await response.json().catch(() => ({ error: null }));
      return { data: json.data, error: json.error || null };
    },
    getPublicUrl(filePath: string) {
      const publicUrl = `/uploads/${bucket}/${pathBasename(filePath)}`;
      return { data: { publicUrl } };
    },
  };
}

function pathBasename(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

export function createLocalDbClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    rpc: async () => ({ data: null, error: null }),
    auth: {
      async getUser() {
        return { data: { user: currentUser() }, error: null };
      },
    },
    storage: {
      from(bucket: string) {
        return createStorageBucket(bucket);
      },
    },
  };
}
