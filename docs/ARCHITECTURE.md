# note-chat — Architecture

note-chat is a Claude-powered RAG assistant that answers natural-language questions over CRM notes. It's a single-agent system built around a structured retrieval-then-generate pipeline, with production reliability patterns wrapped around the LLM calls.

Stack: **NestJS (Node.js / TypeScript)** · **PostgreSQL (TypeORM)** · **Claude API (Opus / Haiku)** · **LangChain / LangGraph**.

---

## High-level flow

```
Query
  │
  ▼
[Classify] ──► complexity check (Chain-of-Thought keyword detection)
  │
  ▼
[Retrieve] ──► in-memory hybrid search (BM25 + Jaccard + metadata)
  │
  ▼
[Select]  ──► importance-weighted chunk selection within a 5K-token budget
  │
  ▼
[Generate] ─► Claude answers over the selected chunks
  │
  ▼
Response
```

The four stages are orchestrated as a **LangGraph state machine** with conditional edges (e.g. simple vs. complex queries take different prompt paths). State is passed explicitly between nodes.

---

## Module structure

The backend is organized into modular NestJS services (dependency-injected so each piece is independently testable):

- **LlmService** — the single wrapper around the Anthropic API. `callClaude(messages, temperature, maxTokens, model)` returns both the text and token usage, so cost and latency can be tracked downstream.
- **ModelSelectorService** — inspects each request and routes low-risk / simple work to **Haiku** and higher-stakes / complex work to **Opus**, to avoid paying for the large model on trivial calls.
- **Search service** — holds notes in memory and computes the hybrid relevance score (see below).
- **Agent / orchestration** — the LangGraph pipeline that ties classify → retrieve → select → generate together.
- **CacheManagerService** — multi-level caching (see below).
- **Persistence** — PostgreSQL via TypeORM, with `Note` and `NoteChunk` entities in a one-to-many relationship.

---

## Retrieval (the core of the system)

Retrieval is **in-memory and lexical** — Postgres stores the data, but ranking happens in the service layer, not in the database. There are **no embeddings, no pgvector, and no `tsvector`/`ts_rank`.** For each note, three signals are computed and fused:

| Signal | What it does | Weight |
|--------|--------------|--------|
| **BM25** | Keyword relevance, via the `bm25` npm package over tokenized text | 50% |
| **Jaccard token overlap** | Fuzzy lexical similarity (intersection-over-union of query vs. note tokens) | 30% |
| **Metadata boost** | Capitalized-name matching, keyword matching, and recency decay | 20% |

The fused score (`0.5·BM25 + 0.3·Jaccard + 0.2·metadata`) is then sorted and thresholded to produce candidate chunks.

### Chunking
On ingestion, `storeNote()` saves the note, then splits its text into **~500-token chunks with ~50-token overlap** (overlap preserves context across chunk boundaries) and persists the chunks linked back to the parent note.

### Context selection
Before calling Claude, candidate chunks are scored by **`0.7 · relevance + 0.3 · recency`**, sorted, and packed into a **5K-token budget** so only the highest-value context is sent — then ordered chronologically for readability.

---

## Reliability patterns

Because the Claude API can fail or slow down, the LLM calls are wrapped in production patterns:

- **Circuit breaker** — `CLOSED → OPEN → HALF_OPEN`. Opens after repeated failures, half-opens to test recovery, so a failing dependency doesn't cascade.
- **Retry with exponential backoff** — transient failures are retried (e.g. 100ms → 200ms → 400ms) up to a max, then fail gracefully.
- **Graceful degradation** — explicit handling for missing-data / no-result cases rather than throwing.

---

## Caching

Multi-level, to avoid redundant Claude calls:

- **Fact-extraction cache** — a hash-based exact-match cache plus a near-duplicate cache, so re-submitting the same or nearly-identical note skips the extraction call.
- **Response cache** — repeat queries reuse the selected-chunks / response so identical questions don't re-run the full retrieve-and-generate cycle.

---

## Fact extraction

`extractFacts()` sends note text to Claude with a structured prompt and parses back JSON (name, summary, topics, sentiment, confidence). It strips markdown code fences before `JSON.parse`, since the model sometimes wraps JSON in code blocks.

---

## Observability

Health and metrics endpoints expose: latency, cost-per-call, cache-hit rate, candidates retrieved, chunks selected, and context utilization — so the system is measurable rather than a black box.

---

## Evaluation

A **50-query evaluation harness**, stratified across simple lookups, complex comparisons, and edge cases, scores the system end to end. Current result: **88% accuracy** on that set. (Single measured result — there was no earlier baseline run to compare against.)

---

## What's intentionally *not* here (and why)

Being explicit about the boundaries, since these are common assumptions:

- **No dense embeddings / vector search.** Retrieval is lexical (BM25 + Jaccard). An early TF-IDF attempt scored a relevant note 0 on a matching query, which is what motivated the hybrid rebuild.
- **No pgvector / `tsvector`.** Ranking is in-memory in the service layer.
- **Single agent, not multi-agent.** It's one structured pipeline (classify → retrieve → select → generate), not multiple coordinating agents.

## Next steps

- Swap the in-memory lexical layer for **dense embeddings + pgvector** (ANN) to add true semantic retrieval.
- Add **cross-encoder reranking** on top of first-stage retrieval.
- Move toward true semantic retrieval at scale as note volume grows.
