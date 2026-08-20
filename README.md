# Note Chat for CRM

AI-powered fact extraction from customer notes using Claude.

## ✅ What Works Today

```bash
# Start the server
npm run start:dev

# Extract facts from a CRM note
curl -X POST http://localhost:3000/research/extract-facts \
  -H "Content-Type: application/json" \
  -d '{"note": "Met with John from Acme Corp..."}'
```

**Response:**

```json
{
  "name": "Acme Corp",
  "summary": "Met with John...",
  "topics": ["support automation", "budget"],
  "sentiment": "positive",
  "confidence": 0.92
}
```

## 🏗 Architecture
