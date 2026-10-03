CREATE TABLE IF NOT EXISTS visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO counters (id, current_count, total_count)
VALUES (1, 0, 0);
