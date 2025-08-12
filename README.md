# Trip Planner (Web)

Plan hiking and biking routes with distance constraints, snap to roads, check weather, and save trips.  
- Hike: 5–15 km/day (loop ends where it starts)  
- Bike: 30–60 km/day (open route)

## Stack
- Client: React + React Router + Leaflet
- Server: Node.js + Express + MongoDB (Mongoose)
- Auth: JWT (bcrypt)
- Geodata: OpenStreetMap (Nominatim + OSRM)
- LLM: OpenAI (gpt-5-mini by default)

## Quick start

### 1) Server
```bash
cd server
npm i
# .env
# MONGO_URI=...
# PORT=3001
# JWT_SECRET=your_secret
# JWT_EXPIRATION=5h
# OPENAI_API_KEY=sk-...
# LLM_MODEL=gpt-5-mini
npm run dev

