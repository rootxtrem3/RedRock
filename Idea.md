# Red-Rock

**Goal:** Build an interactive Mars exploration platform that helps users understand locations, assess survival conditions, and find safer routes.

**Main Concern:** Making reliable exploration decisions using
- fragmented, 
- incomplete, 
- sometimes uncertain Mars scientific data.

**Limitations:** Data coverage and accuracy vary. Survival assessments and route recommendations are estimates, not guarantees of safety. Red-Rock is not a certified mission-planning system.

**Uniqueness:** Unlike a conventional Mars map, Red-Rock 
 - turns scientific data into actionable location intelligence. 
 - focuses not just on what Mars looks like, but on what it might be like to explore and survive there.

**Core Idea:** Explore Mars. Understand the risks. Find the safer way.

## Tech Stack & Why

- **React + TypeScript** - For a responsive, interactive frontend.
- **Tailwind CSS** - For fast, consistent styling.
- **CesiumJS / Three.js** - For the interactive 3D Mars globe.
- **Node.js + TypeScript** - Runs the backend and handles API requests.
- **Express.js** - Simple, flexible API server.
- **npm** - Manages packages, dependencies, and scripts.
- **GDAL + Rasterio** - For processing NASA terrain and scientific datasets (through a separate data-processing workflow if needed).
- **Turf.js** - For geospatial calculations in JavaScript.
- **NetworkX / A*** - For route-planning algorithms, with a Node-compatible implementation where needed.
- **Zod** - For validating API inputs and data.
