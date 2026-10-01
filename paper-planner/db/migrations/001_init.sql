-- Paper planner schema. Applied once; tracked in schema_version.

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE papers (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  venue TEXT NOT NULL DEFAULT '',
  word_limit INTEGER,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','researching','drafting','revising','submitted')),
  thesis TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE thesis_versions (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_thesis_versions_paper ON thesis_versions(paper_id, id);

CREATE TABLE milestones (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_milestones_paper ON milestones(paper_id, sort_order);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (paper_id, name)
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  heading TEXT NOT NULL,
  claim TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'empty'
    CHECK (status IN ('empty','notes','drafted','revised')),
  word_target INTEGER,
  role TEXT NOT NULL DEFAULT 'argument'
    CHECK (role IN ('argument','counterargument','response','background')),
  responds_to INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sections_paper ON sections(paper_id, parent_id, sort_order);

CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'article'
    CHECK (type IN ('case','statute','regulation','article','book','treatise','website','other')),
  citation TEXT NOT NULL,
  short_cite TEXT NOT NULL,
  year INTEGER,
  publisher TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  pdf_path TEXT,
  read_status TEXT NOT NULL DEFAULT 'unread'
    CHECK (read_status IN ('unread','skimmed','read')),
  relevance TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sources_paper ON sources(paper_id);

CREATE TABLE source_tags (
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, tag_id)
);

CREATE TABLE extracts (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  pin_cite TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'support'
    CHECK (kind IN ('support','counter','background','definition')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_extracts_source ON extracts(source_id);

CREATE TABLE extract_tags (
  extract_id INTEGER NOT NULL REFERENCES extracts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (extract_id, tag_id)
);

CREATE TABLE extract_sections (
  extract_id INTEGER NOT NULL REFERENCES extracts(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (extract_id, section_id)
);
CREATE INDEX idx_extract_sections_section ON extract_sections(section_id);

CREATE TABLE section_sources (
  id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'support'
    CHECK (purpose IN ('support','counter','background')),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (section_id, source_id)
);
CREATE INDEX idx_section_sources_source ON section_sources(source_id);

CREATE TABLE citation_log (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  pin_cite TEXT,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  extract_id INTEGER REFERENCES extracts(id) ON DELETE SET NULL,
  used_in TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual','extract_link','source_link')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_citation_log_paper ON citation_log(paper_id);

CREATE TABLE open_questions (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_open_questions_paper ON open_questions(paper_id);

CREATE TABLE drafts (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_drafts_paper ON drafts(paper_id, id);

-- Full-text search over extract text and notes (external-content FTS5 table kept in sync by triggers).
CREATE VIRTUAL TABLE extracts_fts USING fts5(
  text, note,
  content='extracts', content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER extracts_ai AFTER INSERT ON extracts BEGIN
  INSERT INTO extracts_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
END;
CREATE TRIGGER extracts_ad AFTER DELETE ON extracts BEGIN
  INSERT INTO extracts_fts(extracts_fts, rowid, text, note) VALUES ('delete', old.id, old.text, old.note);
END;
CREATE TRIGGER extracts_au AFTER UPDATE ON extracts BEGIN
  INSERT INTO extracts_fts(extracts_fts, rowid, text, note) VALUES ('delete', old.id, old.text, old.note);
  INSERT INTO extracts_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
END;
