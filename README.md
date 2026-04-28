# 🥗 MunchMates
**Capstone Project – Fall 2025 → Spring 2026**  
**Team 17 • University of Kansas • EECS 582: Computer Science Capstone**  
**A full video demo for this project is in development as of 04/2026**
<br/>
**Halfway-point demonstration from 12/2025: [MunchMates Demo](https://drive.google.com/file/d/1emgFaO0tZ4wGwE9JFasXCoqDHG3-TNd6/view?usp=sharing)**
---

<p align="center">
  <img src="munchmates/public/MunchTheMascot.JPG" width="120" alt="Munch Mates Icon">
</p>

<p align="center"><strong>Your meal planning companion, Munch!</strong></p>

---

## 📖 Overview

**MunchMates** is a full-stack, intelligent meal planning and recipe management application designed to make cooking simpler and smarter.  
The platform integrates **ingredient recognition**, **recipe discovery**, **dietary filtering**, **saved collections**, **pantry management**, **community sharing**, and **grocery list automation** into a polished and cohesive user experience.

### 🌟 Core Capabilities
- 🔐 **Secure authentication** powered by Keycloak
- 🍳 **Spoonacular-based recipe recommendations**
- 📷 **Ingredient image classification**
- ⭐ **Save & organize recipes** in personal collections
- 🛒 **Automatic grocery list** generation with smart ingredient aggregation
- 📅 **Weekly meal planning** calendar
- 🥘 **Custom recipe creation** with full macro tracking
- 🧑‍🤝‍🧑 **Community feed** for sharing meals and posts
- 🏪 **Pantry management** with auto-deduction on cook

---

## 👥 Team Members

| Name | Role |
|------|------|
| **Aidan Ingram** | Scrum Master / Developer |
| **Hale Coffman** | Product Owner / Developer |
| **Aryan Kevat** | Developer / Head Logic Designer |
| **Olivia Blankenship** | Developer / Tester |
| **Sam Suggs** | Developer / Tester |
| **Landon Bever** | Developer / Tester |

---

## 🚀 Feature Set

### 🔑 Authentication & User Management
- Keycloak login, registration, and session handling
- Custom branded Keycloak theme matching app style
- JWT-verified API endpoints with role-based access (admin vs. user)
- Profile page with persistent settings saved to PostgreSQL
- Account deletion functionality

### 🍽️ Recipe Discovery & Filtering
- Search the Spoonacular API by ingredients or keywords
- Dietary filters (vegan, gluten-free, vegetarian, etc.) with preferences saved to profile
- Sort results by number of matching pantry ingredients
- Detailed recipe pages with nutrition display and serving size adjustment
- Print-friendly recipe view

### 🤖 Ingredient Image Detection
- Upload a single ingredient image
- AI/ML classifier identifies the ingredient
- Auto-fetch relevant recipes from result

### 📚 Saved Recipes & Collections
- Create, rename, and delete personal recipe collections
- Save Spoonacular and custom recipes to any collection
- "My Recipes" dedicated page for managing everything in one place

### 🥘 Custom Recipes
- Create fully custom recipes with ingredients, steps, and macros
- Edit macros, serving sizes, and ingredients after creation
- Custom recipes integrate natively with the meal planner and grocery list generation

### 🛍️ Grocery List & Meal Planner
- Weekly meal planning dashboard with saved meal slots
- Plan meals using both Spoonacular and custom recipes
- Smart ingredient aggregation across all planned meals — units normalized and duplicates consolidated (e.g. "1 cup + 2 tbsp flour" merged correctly)
- Automatically generated, categorized grocery list
- Dietary tracking integrated into the meal planner

### 🏪 Pantry Management
- Add ingredients manually or via image recognition
- "What Can I Make?" — filters recipes based on current pantry contents with ingredient normalization
- Auto-deduct pantry ingredients when a recipe is cooked
- Pantry-to-grocery-list intersection highlights what you're missing
- Inline edit, remove, and clear all functionality

### 🧑‍🤝‍🧑 Community Feed
- Social feed with posts, munches (shared meal plans), and comments
- Browse and interact with the MunchMates community

### 🔒 Security & Performance
- Rate limiting via Redis middleware applied across all API routes
- Redis caching layer for Spoonacular API responses
- API key protection on all external service routes
- Swagger / OpenAPI documentation for all internal routes

### 🧪 Developer Experience
- CI pipeline with lint, type check, and test stages (GitHub Actions)
- Vitest unit testing setup
- Docker Compose environment with Keycloak realm import and Mailpit for local email testing
- Shared TypeScript types and helper utilities across frontend and backend

---

## 🛠️ Tech Stack

### 🎨 Frontend
- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS

### 🔐 Backend & Auth
- Next.js API Routes
- PostgreSQL via Prisma ORM
- Keycloak (self-hosted identity provider)
- Mailpit (local email testing)
- JWT-based auth flow

### 🌐 APIs & Services
- Spoonacular REST API
- Internal ingredient image classification service
- Redis (caching + rate limiting)

### ⚙️ Dev Tools
- Docker & Docker Compose
- Node.js 20+ / npm 10+
- GitHub Actions CI
- Vitest
- Swagger / OpenAPI

---

## ▶️ Running the Application (Local Development)

### 1. Clone & Enter Project

macOS/Linux:
```bash
git clone <YOUR-REMOTE-URL> munchmates
cd munchmates
```

Windows PowerShell:
```powershell
git clone <YOUR-REMOTE-URL> munchmates
Set-Location .\munchmates
```

### 2. Environment Setup

macOS/Linux:
```bash
cp .env.local.example .env.local
```

Windows:
```powershell
Copy-Item .env.local.example .env.local
```

Required environment variables:
```env
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=dev
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=my-react-client
NEXT_PUBLIC_MAILPIT_URL=http://localhost:8025
KEYCLOAK_ISSUER=http://localhost:8080/realms/dev
SPOONACULAR_API_KEY=your-api-key
KEYCLOAK_ADMIN_CLIENT_ID=keycloak-admin-client-id
KEYCLOAK_ADMIN_CLIENT_SECRET=keycloak-admin-secret-num
```
*Note: You must create a Keycloak client with admin roles to use the final two credentials. See `munchmates/SPOONACULAR_SETUP.md` for Spoonacular setup details.*

### 3. Install Dependencies
```bash
npm ci
# or
npm install
```

### 4. Start Everything

**Option A — Single command:**
```bash
npm run dev:all
```

**Option B — Run separately:**

Terminal 1:
```bash
npm run kc:up+logs
```
Terminal 2:
```bash
npm run dev
```

**Option C — Manual Docker fallback:**

Terminal 1 (in `login/keycloak` directory):
```bash
docker compose up
```
Terminal 2 (in `munchmates` directory):
```bash
npm run dev
```

---

## 📍 Local URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Keycloak Admin | http://localhost:8080/admin/dev/console |
| Mailpit | http://localhost:8025 |

---

## 🔧 Useful Commands

```bash
npm run kc:down      # Stop Keycloak stack
npm run kc:nuke      # Reset Keycloak data & re-import realm
npm run kc:logs      # Tail Keycloak logs
```

---

## 🎨 Keycloak Theme Setup

### New Team Members
No action required — the theme imports automatically.

### Existing Members (Setup before 11/5)
1. Go to http://localhost:8080/admin/dev/console
2. Open the **dev** realm
3. Navigate to **Realm Settings → Themes**
4. Set **Login Theme = munchmates**
5. Save

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| Stuck on "Checking session…" | Keycloak container not reachable — check Docker |
| Missing Keycloak theme | Set theme manually (see above) |
| `keycloak-js` not found | Run `npm ci` |
| Ports 3000 / 8080 / 8025 in use | Free them or update config |
| Realm didn't import | Run `npm run kc:nuke` and restart |
| Grocery list returns empty | Check `SPOONACULAR_API_KEY` is set and valid |

---

## 📂 Documentation

- [Requirement Stack](https://docs.google.com/spreadsheets/d/1tIHhPo6bOL9eVPZegeKziGUcNpKWi4lBoVX56LpTFzA/edit?usp=sharing)
- [User Story Reference](https://docs.google.com/spreadsheets/d/1bFJEMlm_VBw6wxdow4GiaQh48IArsEXu_b9iP1G-xVg/edit?usp=sharing)
- [Capstone Script](https://docs.google.com/document/d/1i2cio2h-fqG7gQWwD1nb_JBMak__AypLeUuCeE-08y0/edit?usp=sharing)
- [Video Demo](https://drive.google.com/file/d/1emgFaO0tZ4wGwE9JFasXCoqDHG3-TNd6/view?usp=sharing)

---

<p align="center">
  <strong>🍽️ Built with care by the MunchMates team — Bon appétit!</strong>
</p>
