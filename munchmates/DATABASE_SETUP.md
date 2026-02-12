# Database Setup Guide

MunchMates uses PostgreSQL with Prisma ORM for data persistence. The database runs in the same Docker Compose stack as Keycloak.

## Prerequisites

- Docker Desktop (running)
- Node.js 20+
- npm

**All commands below assume you are in the `munchmates/` directory:**

```bash
cd munchmates
```

Make sure the Keycloak Docker stack is running:

```bash
docker compose -f login/keycloak/docker-compose.yml up -d --wait
```

## Setup (for existing Keycloak users)

If you already have the Keycloak Docker stack running (which you most likely do), follow these steps. The MunchMates app database shares the same Postgres container as Keycloak but uses its own database and user.

### 1. Create the MunchMates Database

Run this once to create the database and user inside the existing Postgres container:

```bash
docker exec -i keycloak-db-1 psql -U keycloak -d keycloak \
  -c "CREATE USER munchmates WITH PASSWORD 'munchmates_dev' CREATEDB;" \
  -c "CREATE DATABASE munchmates OWNER munchmates;"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example env file if you haven't already:

```bash
cp .env.local.example .env.local
```

The `DATABASE_URL` is already set to the local dev default:
```
DATABASE_URL="postgresql://munchmates:munchmates_dev@localhost:5433/munchmates"
```

Note: The database runs on port **5433** (not the default 5432) to avoid conflicts with other local Postgres instances.

### 4. Run Migrations

```bash
npx prisma migrate dev
```

This creates all database tables and generates the Prisma client. You should see all migrations applied successfully.

### 5. Verify the Migration

Run this to confirm all tables were created:

```bash
docker exec -i keycloak-db-1 psql -U munchmates -d munchmates -c "\dt"
```

You should see all 12 tables listed:

| Table |
|---|
| CollectionMember |
| CollectionRecipe |
| CustomRecipe |
| GroceryCategory |
| GroceryItem |
| MealEntry |
| PantryItem |
| SavedRecipe |
| SharedCollection |
| User |
| UserProfile |
| WeeklyMealPlan |

If any are missing, re-run `npx prisma migrate dev`. If you see `_prisma_migrations` as well, that's normal — Prisma uses it to track applied migrations.

### 6. Start the App

```bash
npm run dev
```

That's it — the app will now persist data to the database.

## Fresh Clone Setup (no Docker yet)

If you're starting from scratch with no Docker containers at all:

1. Start Docker services:
   ```bash
   docker compose -f login/keycloak/docker-compose.yml up -d --wait
   ```
   This starts PostgreSQL, Keycloak, and Mailpit. The init script at `login/keycloak/init-munchmates-db.sql` automatically creates the `munchmates` database and user on first container creation, so you can skip the manual create step above.

2. Then follow steps 2-5 from the section above.

## Daily Development

Start everything (Keycloak + Postgres + Next.js) with one command:

```bash
npm run dev:all
```

Or start services separately:

```bash
# Start Docker services
docker compose -f login/keycloak/docker-compose.yml up -d --wait

# Start Next.js
npm run dev
```

## Common Commands

| Command | Description |
|---|---|
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |
| `npm run db:push` | Push schema changes without creating a migration |
| `npm run db:generate` | Regenerate the Prisma client |

## Making Database Changes (Full Guide)

Adding a new table, column, or modifying the schema involves changes across several layers.
Below is the full workflow from database to UI.

### 1. Update the Prisma Schema

Edit `prisma/schema.prisma` to add or modify a model. Example — adding a new `Review` model:

```prisma
model Review {
  id        Int      @id @default(autoincrement())
  userId    String
  recipeId  Int
  rating    Int
  comment   String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([recipeId])
}
```

If adding a relation, make sure the other model has a matching field:
```prisma
model User {
  // ... existing fields ...
  reviews Review[]
}
```

### 2. Create and Run the Migration

```bash
npx prisma migrate dev --name add-reviews
```

This does three things:
- Generates a SQL migration file in `prisma/migrations/`
- Applies it to your local database
- Regenerates the Prisma client with updated types

If you only changed types (not the DB schema), run just:
```bash
npx prisma generate
```

### 3. Create an API Route

Create a new route handler in `app/api/`. Convention: `app/api/<feature>/route.ts`.

```
app/api/reviews/route.ts
```

Basic structure:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

// GET — fetch data for the authenticated user
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const reviews = await prisma.review.findMany({
            where: { userId },
        });

        return NextResponse.json({ ok: true, reviews });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST — create a new record
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const body = await req.json();

        // Validate, then create
        const review = await prisma.review.create({
            data: { userId, ...body },
        });

        return NextResponse.json({ ok: true, review }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
```

Key patterns used across the codebase:
- **Auth:** `verifyBearer()` from `lib/verifyToken` extracts the user ID from the Keycloak JWT
- **User upsert:** If creating data for a user who may not have a `User` row yet, upsert first:
  ```ts
  await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
  });
  ```
- **Error handling:** Always catch `"no token"` errors and return 401

### 4. Call the API from the Frontend

Use `authedFetch` from `lib/authedFetch.ts` — it automatically attaches the Keycloak Bearer token:

```ts
import { authedFetch } from '@/lib/authedFetch';

// GET
const res = await authedFetch('/api/reviews');
const data = await res.json();

// POST
const res = await authedFetch('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ recipeId: 123, rating: 5, comment: 'Great!' }),
});
```

Note: `authedFetch` sets `Content-Type: application/json` automatically.
Use plain `fetch()` only for unauthenticated endpoints (e.g. Spoonacular proxy routes).

### 5. Commit Everything

A complete database change includes these files:

```
prisma/schema.prisma                          # Updated schema
prisma/migrations/<timestamp>_<name>/         # Generated migration SQL
app/api/<feature>/route.ts                    # New or updated API route
app/(app)/<page>/page.tsx or components/      # Frontend changes
```

### Quick Reference

| Task | Command |
|---|---|
| Add/change a model | Edit `prisma/schema.prisma` |
| Create migration + apply | `npx prisma migrate dev --name <name>` |
| Regenerate client only | `npx prisma generate` |
| Push schema without migration (prototyping) | `npx prisma db push` |
| View data in browser | `npx prisma studio` |
| Reset database (destroys data) | `npx prisma migrate reset` |

## Database Architecture

The `munchmates` database shares the Postgres container with Keycloak but uses a separate database and user.

### Tables

| Table | Purpose |
|---|---|
| `User` | Base user record (ID from Keycloak `sub` claim) |
| `UserProfile` | Cuisine preferences, diets, intolerances |
| `SavedRecipe` | Bookmarked Spoonacular recipes |
| `CustomRecipe` | User-created recipes (IDs start at 100000) |
| `WeeklyMealPlan` | Meal plan header per user per week |
| `MealEntry` | Individual meals within a plan |
| `SharedCollection` | Shared recipe collections |
| `CollectionMember` | Collection membership and roles |
| `CollectionRecipe` | Recipes added to collections |
| `PantryItem` | User's ingredient inventory with expiry tracking |
| `GroceryItem` | Shopping list items with completion status |
| `GroceryCategory` | User's custom grocery categories |

### Prisma Client

The Prisma client singleton lives at `lib/prisma.ts`. It uses the `@prisma/adapter-pg` driver adapter (required by Prisma 7) and prevents connection pool exhaustion during Next.js hot-reload.

## Troubleshooting

**"Connection refused" on migrate or app startup**
- Ensure Docker is running: `docker ps`
- Check the db container is healthy: `docker compose -f login/keycloak/docker-compose.yml ps`

**"database munchmates does not exist" or "role munchmates does not exist"**
- You need to run the manual create step from Setup step 1 above.

**"relation already exists" or migration errors after pulling new changes**
- Run `npx prisma migrate dev` to apply any new migrations from the merged branch
- If migrations conflict, reset the dev database: `npx prisma migrate reset`

**"P3014: Shadow database error"**
- The `munchmates` database user needs `CREATEDB` permission. Connect as the `keycloak` superuser and run:
  ```sql
  ALTER USER munchmates CREATEDB;
  ```

**Prisma client out of sync with schema**
- Run `npx prisma generate` to regenerate the client after schema changes

**Nuclear option (reset everything)**
- This destroys all data including Keycloak users and realm config:
  ```bash
  docker compose -f login/keycloak/docker-compose.yml down -v
  docker compose -f login/keycloak/docker-compose.yml up -d --wait
  npx prisma migrate dev
  ```
