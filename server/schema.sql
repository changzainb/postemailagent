PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id     INTEGER NOT NULL REFERENCES scenarios(id),
  name            TEXT NOT NULL UNIQUE,
  name_normalized TEXT NOT NULL,
  aliases         TEXT DEFAULT '[]',
  status          TEXT DEFAULT 'active',
  source          TEXT DEFAULT 'history',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_norm ON products(name_normalized);
CREATE INDEX IF NOT EXISTS idx_products_scenario ON products(scenario_id);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id               INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  normal_discount          TEXT DEFAULT '',
  normal_commission        TEXT DEFAULT '',
  breakthrough_discount    TEXT DEFAULT '',
  breakthrough_commission  TEXT DEFAULT '',
  no_commission            INTEGER DEFAULT 0,
  remark                   TEXT DEFAULT '',
  updated_by               TEXT DEFAULT '',
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL,
  snapshot    TEXT NOT NULL,
  action      TEXT NOT NULL,
  actor       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS missing_products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_name     TEXT NOT NULL,
  reported_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'business',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 行业 → 产品 自定义映射（后台手动维护，前端按行业出产品列表）
CREATE TABLE IF NOT EXISTS industry_products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  industry_key  TEXT NOT NULL,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order    INTEGER DEFAULT 0,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(industry_key, product_id)
);
CREATE INDEX IF NOT EXISTS idx_indprod_key ON industry_products(industry_key);

