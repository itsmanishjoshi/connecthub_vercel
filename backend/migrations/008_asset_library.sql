-- GCC Assets library: folders, files (metadata + bytes), sharing.
CREATE TABLE IF NOT EXISTS asset_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'assets',
  description TEXT,
  restricted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_folders_library ON asset_folders(library_id, parent_id);

CREATE TABLE IF NOT EXISTS asset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT,
  kind TEXT NOT NULL DEFAULT 'other',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'db',
  content BYTEA,
  disk_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_items_folder ON asset_items(library_id, folder_id);

CREATE TABLE IF NOT EXISTS asset_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_access_uniq
  ON asset_access (library_id, user_id, (COALESCE(folder_id, '00000000-0000-0000-0000-000000000000')));

CREATE INDEX IF NOT EXISTS idx_asset_access_user ON asset_access(user_id, library_id);
