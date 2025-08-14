# 🗺️ Trip Planner

Create hiking/biking routes with an AI assist, preview them on a Leaflet map, check weather, and save trips for later.

- **Client:** React + React Router + React-Leaflet + Tailwind  
- **Server:** Node.js + Express  
- **Routing:** OSRM (public server) + LLM-assisted fallback (`routeLLM.js`)  
- **Persistence:** Lightweight JSON store (no DB required)

---

## Table of contents

- [Screens & how they work](#screens--how-they-work)
  - [Home (Welcome)](#home-welcome)
  - [Planner](#planner)
  - [My Trips](#my-trips)
  - [Login / Logout (optional)](#login--logout-optional)
- [How route generation works](#how-route-generation-works)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Screens & how they work

### Home (Welcome)

The entry point after launching the app. A clean welcome card explains the core features and provides a single call-to-action to open the planner.

![Home / Welcome](docs/images/home-welcome.png)
*Welcome page with a one-click “Open Planner” button and a framed top navbar.*

**What you can do here**

- Navigate using the framed navbar buttons (**Home**, **Planner**, **My Trips**, **Logout**).
- Click **Open Planner** to start creating a route.

---

### Planner

This is where you generate, preview, and save routes.

#### 1) Before generating

![Planner – initial](docs/images/planner-empty.png)
*Planner with the toolbar in a single line: City, Go, Mode, Days, Generate/Reset, Weather, Save.*

**Toolbar controls (left ➜ right)**

- **City/Country** – the place you want to plan around (e.g., `tokyo`, `new york`, `tel aviv`).  
- **Go** – pans the map to the city (quick geocode).  
- **Mode** – `Trek (loop)` or `Bike (open)`.  
- **Days** – trip length (kept to two digits; affects target distance).  
- **Generate** – builds a realistic route using the server (see [How route generation works](#how-route-generation-works)).  
- **Reset** – clears current route and messages.  
- **Get Weather** – quick temperature peek for the current map center.  
- **Save** – saves the current route with a name/description.

Below the toolbar you’ll see:
- **Trip name** (free text)  
- **Description (optional)**  
- **Status line** (e.g., `Generated · ~55 km in 1 days`)  

The map has a soft border/frame and shows OpenStreetMap tiles.

#### 2) After generating

![Planner – generated route](docs/images/planner-generated.png)
*A generated **Bike (open)** route with Start/Finish pins and day split marker.*

- **Blue polyline** – the route snapped to paths/roads via OSRM.  
- **Green “Start” / Red “Finish”** – markers at endpoints.  
- **Blue day markers** – break indices based on target per-day distance.

#### 3) After saving

![Planner – saved](docs/images/planner-saved.png)
*The status line shows **Saved ✓** once the trip is persisted.*

- Click **Save** → the app posts `name`, `description`, `points`, `center`, and `meta` to the server.  
- On success you’ll see **Saved ✓**.  
- Head to **My Trips** to see the history.

---

### My Trips

A simple list page showing all saved trips (newest first). Each list item shows:
- **Trip name**  
- **Mode** (`bike` / `hike`)  
- **Approx distance**  
- **Days**  
- **Saved timestamp**

![My Trips list](docs/images/my-trips.png)
*Saved trips appear as rounded, framed list items.*

> Tip: This build stores trips in a lightweight JSON store on the server, so your history persists across restarts without a database.

---

### Login / Logout (optional)

The UI supports framed **Login/Logout** buttons in the top navbar. In this simplified build, **saving does not require auth**—that was intentional to avoid token issues and keep history persistent.

If you later re-enable auth:
- Add JWT middleware on the server and filter trips by user.
- Send `Authorization: Bearer <token>` from the client.

---

## How route generation works

1. **LLM waypoints** – the server asks an LLM for 5–10 local landmark names within/near your city.
2. **Geocode inside a bounding box** – results are limited around the city to avoid far-off points.
3. **OSRM routing** – we snap the waypoint path onto real roads/paths (`walking` for hikes, `cycling` for bikes).
4. **Distance guardrails** – if the route is too short/long or OSRM fails, we fall back to a **procedural ring** sized to your target distance and re-snap.
5. **Day breaks** – we compute indices along the polyline for per-day markers.

This prevents “lines through the sea” and keeps distances realistic for the selected **days** and **mode**.

---

## Quick start

Open two terminals from the repo root:

**Server**
```bash
cd server
npm i
cp .env.example .env        # Add your OPENAI_API_KEY
npm run dev                 # http://localhost:3001