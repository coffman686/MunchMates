# 🥗 MunchMates
**Capstone Project – Fall 2025 -> Spring 2026**  
**Team 17 • University of Kansas • EECS 582: Computer Science Capstone**  
**The video demo for this project can be found here: [MunchMates Demo](https://drive.google.com/file/d/1emgFaO0tZ4wGwE9JFasXCoqDHG3-TNd6/view?usp=sharing)**
<br/>
**Current live requirement stack: [Requirement Stack](https://docs.google.com/spreadsheets/d/1eePEHFjbzgBVNzvtzwRsuuwQ06P7JTnwYQXF8219UlY/edit?usp=sharing)**
<br/>
**Current live reference stories: [Reference Stories](https://docs.google.com/spreadsheets/d/1gixfukI3HKdBF7ydcMlqZPqSt_f5zdoYoIKE4cyNiXg/edit?usp=sharing)**
<br />
**Complete capstone script: [Capstone Script](https://docs.google.com/document/d/1i2cio2h-fqG7gQWwD1nb_JBMak__AypLeUuCeE-08y0/edit?usp=sharing)**

---

<p align="center">
  <img src="munchmates/public/MunchTheMascot.JPG" width="120" alt="Munch Mates Icon">
</p>

<p align="center"><strong>Your future meal planning companion, Munch!</strong></p>

---
## 📖 Overview

**Munch Mates** is a full-stack, intelligent meal planning and recipe management application designed to make cooking simpler and smarter.  
The platform integrates **ingredient recognition**, **recipe discovery**, **dietary filtering**, **saved collections**, and **grocery list automation** into a polished and cohesive user experience.

### 🌟 Core Capabilities
- 🔐 **Secure authentication** powered by Keycloak  
- 🍳 **Spoonacular-based recipe recommendations**  
- 📷 **Ingredient image classification**  
- ⭐ **Save & organize recipes** in personal or shared collections  
- 🛒 **Automatic grocery list** generation  
- 📅 **Weekly meal planning** calendar  

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

## 🚀 Final Feature Set

### 🔑 Authentication & User Management
- Keycloak login, registration, and session handling  
- Custom branded Keycloak theme  

### 🍽️ Recipe Discovery & Filtering
- Query the Spoonacular API by ingredients or keywords  
- Dietary filters (vegan, gluten-free, vegetarian, etc.)  
- Pageable results  

### 🤖 Ingredient Image Detection
- Upload a single ingredient image  
- AI/ML classifier identifies the ingredient  
- Auto-fetch relevant recipes  

### 📚 Saved Recipes & Collections
- Create, rename, and delete collections  
- Save recipes to any collection  
- 🔄 **Shared multi-user collections** *(coming soon)*  

### 🛍️ Grocery List & Meal Planner
- Auto-generate lists based on selected recipes  
- Editable grocery items  
- Drag-and-drop weekly meal planning calendar  

### 💻 Frontend UI
- Built with **Next.js 14 (App Router)**  
- Fully responsive and mobile-friendly  
- Tailwind CSS design system  

---

## 📂 Documentation

- **Requirement Stack Spreadsheet**  
  https://docs.google.com/spreadsheets/d/1tIHhPo6bOL9eVPZegeKziGUcNpKWi4lBoVX56LpTFzA/edit?usp=sharing

- **User Story Reference Spreadsheet**  
  https://docs.google.com/spreadsheets/d/1bFJEMlm_VBw6wxdow4GiaQh48IArsEXu_b9iP1G-xVg/edit?usp=sharing

---

## 🛠️ Tech Stack

### 🎨 Frontend
- Next.js 14  
- React + TypeScript  
- Tailwind CSS  
- Axios  

### 🔐 Backend & Auth
- Keycloak  
- Mailpit (email testing)  
- JWT-based auth flow  

### 🌐 APIs
- Spoonacular REST API  
- Internal ingredient classification microservice  

### ⚙️ Dev Tools
- Docker & Docker Compose  
- Node.js 20+ / npm 10+  
- Custom orchestration scripts  

---

## ▶️ Running the Application (Local Development)

### 1. Clone & Enter Project

macOS/Linux:
```
git clone <YOUR-REMOTE-URL> munchmates
cd munchmates
```

Windows PowerShell:
```
git clone <YOUR-REMOTE-URL> munchmates
Set-Location .\munchmates
```

### 2. Environment Setup

macOS/Linux:
```
cp .env.local.example .env.local
```

Windows:
```
Copy-Item .env.local.example .env.local
```

Environment variables include:
```
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=dev
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=my-react-client
NEXT_PUBLIC_MAILPIT_URL=http://localhost:8025
KEYCLOAK_ISSUER=http://localhost:8080/realms/dev
SPOONACULAR_API_KEY=your-api-key
KEYCLOAK_ADMIN_CLIENT_ID=keycloak-admin-client-id
KEYCLOAK_ADMIN_CLIENT_SECRET=keycloak-admin-secret-num
```
*Note: You must create a new Keycloak client with admin roles to use the final two credentials.*

### 3. Install Dependencies
```
npm ci
# or
npm install
```

### 4. Start Everything

Option A — Single command:
```
npm run dev:all
```

Option B — Run separately:

Terminal 1:
```
npm run kc:up+logs
```

Terminal 2:
```
npm run dev
```

Option C — Manual Docker fallback (if all else fails):

Terminal 1 (in `login/keycloak` directory):
```
docker compose up
```

Terminal 2 (in `munchmates` directory):
```
npm run dev
```

---

## 📍 Local URLs

- App → http://localhost:3000  
- Keycloak Admin → http://localhost:8080/admin/dev/console  
- Mailpit → http://localhost:8025  

---

## 🔧 Useful Commands

```
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
2. Open the "dev" realm  
3. Navigate to Realm Settings → Themes  
4. Select **Login Theme = munchmates**  
5. Save  

---

## 🩺 Troubleshooting

- Stuck on “Checking session…” → Keycloak container not reachable  
- Missing Keycloak theme → Set theme manually (see above)  
- `keycloak-js` not found → Run `npm ci`  
- Ports 3000/8080/8025 in use → Free them or update configuration  
- Realm didn’t import → Run `npm run kc:nuke` and restart  

---

## 🧾 Final Notes

This README reflects the final polished state of the **Munch Mates** project at the conclusion of EECS 581. It provides a complete reference for running, grading, and further extending the application.

---

<p align="center">
  <strong>🍽️ Built with care by Team 26 — Bon appétit!</strong>
</p>
