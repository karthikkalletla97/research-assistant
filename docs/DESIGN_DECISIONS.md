# note-chat — Design Decisions

This documents the *why* behind the main choices in note-chat — including the things that went wrong and what they led to. The goal is to show the reasoning and the tradeoffs, not just the final architecture.

---

## 1. Why lexical hybrid retrieval instead of embeddings?

**Decision:** Retrieve with an in-memory blend of BM25 + Jaccard token overlap + metadata boosts (fused 50/30/20), rather than dense vector embeddings.

**Why:** The first attempt used in-memory TF-IDF "embeddings" with cosine similarity. It failed — a note clearly about a customer's budget scored **0** on a budget-related query, because TF-IDF is purely lexical with no understanding of the query, and the vectors were sparse and brittle on short notes. Rather than immediately reaching for a hosted embeddings model, I rebuilt retrieval as a hybrid lexical scorer:

- **BM25** handles keyword relevance robustly (and degrades gracefully on short text where TF-IDF didn't).
- **Jaccard token overlap** adds fuzzy lexical matching for near-misses.
- **Metadata boosts** (capitalized-name matching, recency decay) encode domain knowledge specific to CRM notes — names and recency matter a lot here.

**Tradeoff:** This is *lexical*, not *semantic* — it won't match "unhappy" to "frustrated" the way embeddings would. That's a deliberate, acknowledged limitation for a portfolio-scale system, and it's the first thing on the roadmap (see below). The upside is zero embedding-model dependency, cost, or latency, and fully transparent, debuggable scoring.

---

## 2. Why 50 / 30 / 20 weighting?

**Decision:** Fuse the three signals as `0.5·BM25 + 0.3·Jaccard + 0.2·metadata`.

**Why:** BM25 is the most reliable single signal, so it leads. Jaccard is a useful but noisier secondary. Metadata is a *boost*, not a primary ranker — weighting it too high let recency or a name match drown out actual relevance. These weights were tuned against the eval set; they're constants, not learned, which keeps behavior predictable.

---

## 3. Why route between Haiku and Opus?

**Decision:** A `ModelSelectorService` sends simple queries to **Haiku** and complex ones to **Opus**, based on a complexity check.

**Why:** Paying for the largest model on every call is wasteful — most queries are simple lookups that Haiku handles fine. A Chain-of-Thought complexity classifier checks the query for reasoning keywords (why, compare, prioritize, recommend…); complex queries get a structured step-by-step prompt with a larger token budget, simple ones get a direct prompt.

**Tradeoff:** The classifier is keyword-based, so it can misroute an unusually-phrased complex query to Haiku. Acceptable for now; a learned classifier would be the upgrade.

---

## 4. Why a circuit breaker and retry?

**Decision:** Wrap the Claude API in a circuit breaker (`CLOSED → OPEN → HALF_OPEN`) plus exponential-backoff retry.

**Why:** The LLM API is an external dependency that can rate-limit, time out, or fail transiently. Without protection, one failing dependency cascades into failed requests. Retry with backoff absorbs transient blips; the circuit breaker prevents hammering a service that's already down and lets it recover. This is standard production hardening applied to an LLM call — the same rigor I'd give any external dependency.

---

## 5. Why multi-level caching?

**Decision:** Cache at two points — fact extraction (exact-hash + near-duplicate) and full responses (repeat queries).

**Why:** Two different kinds of repeat work happen. Re-submitting the same or nearly-identical note shouldn't re-run extraction (hash + near-duplicate cache). Asking the same question twice shouldn't re-run the whole retrieve-and-generate cycle (response cache). Both cut redundant Claude calls, which is the dominant cost and latency driver.

---

## 6. Why ~500-token chunks with ~50-token overlap?

**Decision:** Split notes into ~500-token chunks with ~50 tokens of overlap.

**Why:** Chunks need to be small enough to retrieve precisely and fit a token budget, but large enough to carry coherent context. Overlap prevents a relevant sentence from being split across a boundary and lost. 500/50 is a common, sensible default for this kind of retrieval; it wasn't heavily tuned.

---

## 7. Why an importance-weighted 5K-token budget?

**Decision:** Select context with `0.7·relevance + 0.3·recency`, packed into a 5K-token budget, then ordered chronologically.

**Why:** You can't send everything to the model — there's a token ceiling and cost per token. Selecting by relevance *and* recency (recent notes matter more in a CRM) and capping at 5K keeps prompts focused and cheap. Ordering the selected chunks chronologically makes the assembled context read naturally for the model.

---

## 8. A real bug worth documenting: the ID mismatch

Early on, retrieval returned chunks that didn't exist. The cause: the in-memory search index was assigning its own counter IDs while Postgres assigned different primary keys, so lookups resolved to the wrong (or missing) records. Fixed by indexing notes under their **actual database ID** rather than a separate in-memory counter. Documenting it because it's a good reminder that "two sources of truth for IDs" is a classic, easy-to-miss integration bug.

---

## Honest limitations

- **Retrieval is lexical, not semantic** — no synonym/paraphrase matching yet.
- **Single agent**, not a multi-agent system — one structured pipeline.
- **Portfolio-scale**, not production-traffic-tested — the metrics reflect an eval set, not live load.
- **Keyword-based complexity routing** can misclassify unusually-phrased queries.

## Roadmap

1. **Dense embeddings + pgvector** to add true semantic retrieval (the direct fix for the biggest limitation above).
2. **Cross-encoder reranking** on top of first-stage retrieval for precision.
3. A **learned** complexity classifier to replace the keyword heuristic.
