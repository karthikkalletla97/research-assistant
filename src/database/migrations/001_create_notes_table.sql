-- Notes table (full text storage)
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(255) DEFAULT 'default_user',
  metadata JSONB DEFAULT '{}'
);

-- Chunks table (for RAG retrieval)
CREATE TABLE note_chunks (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding_vector VECTOR(1024), -- For semantic search if using pgvector
  token_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(note_id, chunk_index)
);

-- Index for faster searches
CREATE INDEX idx_note_chunks_note_id ON note_chunks(note_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);