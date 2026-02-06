# Database Migration Proposal: PostgreSQL + Prisma

**Author:** Team 17
**Date:** February 2026
**Status:** Proposal

---

## The Problem

MunchMates currently has no real database. Data is stored in two ways, both unsuitable for production:

| Storage Method | What Uses It | Problem |
|---|---|---|
| **File-based JSON** (`data/*.json`) | Saved recipes, shared collections | Doesn't scale, no concurrent access safety, tied to a single server instance |
| **In-memory Maps** | User profiles, meal plans, custom recipes | **All data lost on every server restart** |

This means a user's meal plan, dietary preferences, and custom recipes disappear every time the server redeploys or crashes. File-backed data survives restarts but will corrupt under concurrent writes and cannot work across multiple server instances.

---

## The Recommendation: PostgreSQL + Prisma ORM

### Why PostgreSQL

Our data is **relational by nature**. Collections have members with roles. Meal plans reference recipes across days. Grocery lists aggregate ingredients across multiple meals. These are relationships — and a relational database handles them best.

- **Referential integrity** — Foreign keys enforce that a saved recipe always belongs to a real user, a collection member always references a real collection. The database prevents orphaned or inconsistent data.
- **Aggregation queries** — Grocery list generation (summing ingredient amounts, grouping by category across recipes) maps directly to SQL `GROUP BY` and `SUM`. This is significantly simpler and faster than doing it in application code.
- **Role-based access** — Shared collections with owner/editor/viewer roles are enforced at the data level, not just in application logic.
- **ACID transactions** — When adding a recipe to a collection and updating the member's activity timestamp, either both happen or neither does. No partial state.
- **Mature ecosystem** — PostgreSQL is the most widely supported open-source relational database with decades of production use.

### Why Not MongoDB

MongoDB excels with unstructured or highly variable document shapes. Our data models (`SavedRecipe`, `SharedCollection`, `MealPlanEntry`, `ProfileData`) have **well-defined, consistent schemas**. The flexibility of a document store doesn't benefit us, and we'd lose referential integrity and efficient cross-entity queries.

### Why Prisma

Prisma is a TypeScript-first ORM that generates a type-safe database client from a schema file.

- **Type safety** — Prisma generates TypeScript types from the schema. Query results are fully typed with autocomplete. No more `any` types for database responses.
- **Schema-as-code** — The data model lives in a single `prisma/schema.prisma` file, version-controlled alongside the application.
- **Automatic migrations** — When the schema changes, Prisma generates and applies SQL migration files. No hand-written SQL for schema changes.
- **Natural fit with Next.js** — Prisma works directly in Next.js API routes. No separate backend server required.
- **Replaces our storage layer 1:1** — Every `fs.readFileSync` / `Map.get()` call maps to a Prisma method (`findMany`, `create`, `update`, `delete`).

---

## What Changes

### Current Architecture

```
Next.js API Route
       |
       v
  In-Memory Map  or  fs.readFileSync('data/saved-recipes.json')
       |                        |
       v                        v
  Lost on restart       Single JSON file on disk
```

### Proposed Architecture

```
Next.js API Route
       |
       v
  Prisma Client (type-safe, auto-generated)
       |
       v
  PostgreSQL (Docker container, alongside Keycloak & Mailpit)
```

---

## Proposed Schema

This maps directly from our existing TypeScript types to Prisma models.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String             @id // Keycloak user ID (sub)
  savedRecipes     SavedRecipe[]
  customRecipes    CustomRecipe[]
  profile          UserProfile?
  mealPlans        WeeklyMealPlan[]
  collectionMemberships CollectionMember[]
  createdCollections    SharedCollection[]
}

model SavedRecipe {
  id         String   @id @default(uuid())
  userId     String
  recipeId   Int
  recipeName String
  savedAt    DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, recipeId]) // prevent duplicate saves
}

model CustomRecipe {
  id           String   @id @default(uuid())
  userId       String
  title        String
  ingredients  String[]
  instructions String
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserProfile {
  id               String   @id @default(uuid())
  userId           String   @unique
  favoriteCuisines String[]
  diets            String[]
  intolerances     String[]
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SharedCollection {
  id            String             @id @default(uuid())
  name          String
  description   String             @default("")
  createdById   String
  createdByName String
  createdAt     DateTime           @default(now())
  createdBy     User               @relation(fields: [createdById], references: [id])
  members       CollectionMember[]
  recipes       CollectionRecipe[]
}

model CollectionMember {
  id           String           @id @default(uuid())
  collectionId String
  userId       String
  userName     String
  role         CollectionRole   @default(viewer)
  joinedAt     DateTime         @default(now())
  collection   SharedCollection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([collectionId, userId]) // one membership per user per collection
}

model CollectionRecipe {
  id           String           @id @default(uuid())
  collectionId String
  recipeId     Int
  recipeName   String
  addedBy      String
  addedByName  String
  addedAt      DateTime         @default(now())
  collection   SharedCollection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@unique([collectionId, recipeId]) // no duplicate recipes in a collection
}

model WeeklyMealPlan {
  id        String    @id @default(uuid())
  userId    String
  weekStart String    // ISO date string (Monday), e.g. "2026-02-02"
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  meals     MealEntry[]

  @@unique([userId, weekStart]) // one plan per user per week
}

model MealEntry {
  id               String         @id @default(uuid())
  mealPlanId       String
  date             String         // ISO date, e.g. "2026-02-03"
  mealType         MealType       // breakfast, lunch, dinner
  recipeId         Int
  title            String
  image            String?
  servings         Int
  originalServings Int
  mealPlan         WeeklyMealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)

  @@unique([mealPlanId, date, mealType]) // one recipe per meal slot
}

enum CollectionRole {
  owner
  editor
  viewer
}

enum MealType {
  breakfast
  lunch
  dinner
}
```

---

## Migration Plan

### Phase 1: Infrastructure Setup

**Add PostgreSQL to Docker Compose.** A new service alongside our existing Keycloak and Mailpit containers:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: munchmates
      POSTGRES_PASSWORD: munchmates_dev
      POSTGRES_DB: munchmates
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Install Prisma dependencies:**

```bash
npm install prisma @prisma/client
npx prisma init
```

**Add `DATABASE_URL` to environment config:**

```
DATABASE_URL="postgresql://munchmates:munchmates_dev@localhost:5432/munchmates"
```

### Phase 2: Schema & Client Generation

1. Create `prisma/schema.prisma` with the models above
2. Run `npx prisma migrate dev --name init` to generate and apply the initial migration
3. Prisma auto-generates the typed client — available via `import { PrismaClient } from '@prisma/client'`

### Phase 3: Create a Shared Prisma Client Instance

Create a singleton `lib/prisma.ts` to avoid spawning multiple connections in development (a known Next.js hot-reload issue):

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Phase 4: Migrate API Routes (one at a time)

Each route can be migrated independently. The general pattern for each:

**Before (file-based):**
```typescript
import { getSavedRecipes } from '@/lib/savedRecipesStore'

export async function GET(req: Request) {
  const recipes = getSavedRecipes(userId)
  return NextResponse.json(recipes)
}
```

**After (Prisma):**
```typescript
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const recipes = await prisma.savedRecipe.findMany({
    where: { userId }
  })
  return NextResponse.json(recipes)
}
```

Recommended migration order (least to most complex):

| Order | Route | Current Storage | Complexity |
|-------|-------|----------------|------------|
| 1 | `api/profile` | In-memory Map | Low — simple key-value per user |
| 2 | `api/recipes/saved` | File-backed JSON | Low — basic CRUD |
| 3 | `api/recipes/create` | In-memory Map | Low — basic CRUD |
| 4 | `api/meal-plan` | In-memory Map | Medium — nested plan/entry structure |
| 5 | `api/shared-collections/*` | File-backed JSON | Higher — relations (members, roles, recipes) |

### Phase 5: Cleanup

- Delete `lib/savedRecipesStore.ts` and `lib/sharedCollectionsStore.ts`
- Delete the `data/` directory and its JSON files
- Remove `fs` imports from API routes
- Remove in-memory Map declarations from route files

---

## Files Affected

### New Files
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema definition |
| `prisma/migrations/` | Auto-generated SQL migration files |
| `lib/prisma.ts` | Shared Prisma client singleton |

### Modified Files
| File | Change |
|---|---|
| `docker-compose.yml` | Add PostgreSQL service |
| `.env` / `.env.local` | Add `DATABASE_URL` |
| `package.json` | Add `prisma` and `@prisma/client` deps |
| `app/api/profile/route.ts` | Replace in-memory Map with Prisma calls |
| `app/api/recipes/saved/route.ts` | Replace file store with Prisma calls |
| `app/api/saved-recipes/route.ts` | Replace file store with Prisma calls |
| `app/api/recipes/create/route.ts` | Replace in-memory Map with Prisma calls |
| `app/api/meal-plan/route.ts` | Replace in-memory Map with Prisma calls |
| `app/api/shared-collections/route.ts` | Replace file store with Prisma calls |
| `app/api/shared-collections/[id]/route.ts` | Replace file store with Prisma calls |
| `app/api/shared-collections/[id]/members/route.ts` | Replace file store with Prisma calls |

### Deleted Files
| File | Reason |
|---|---|
| `lib/savedRecipesStore.ts` | Replaced by Prisma |
| `lib/sharedCollectionsStore.ts` | Replaced by Prisma |
| `data/saved-recipes.json` | No longer needed |
| `data/shared-collections.json` | No longer needed |

---

## Risks and Considerations

- **Docker requirement** — All developers will need to run `docker compose up` to start PostgreSQL locally. This is already required for Keycloak, so the workflow doesn't change.
- **Migration conflicts** — If multiple branches modify the Prisma schema, migrations can conflict. Resolve by running `npx prisma migrate dev` after merging.
- **No existing production data** — Since current data is ephemeral or local-only, there is no user data to migrate. This is a clean-slate setup.
- **Keycloak user IDs** — The `User` table uses Keycloak's `sub` (subject) as the primary key. Users are created in our database on first interaction, not synced from Keycloak in bulk.

---

## Future Benefits

Once PostgreSQL is in place, several items from our requirements backlog become straightforward:

- **Caching layer (Redis)** — Can sit between Prisma and the API for Spoonacular responses
- **Community features** — Real user-to-user interactions backed by persistent storage
- **Nutrition tracking** — Store daily macro targets and history
- **Pantry management** — Track inventory with quantities and expiry dates
- **Recipe ratings/reviews** — Just more Prisma models and relations
- **CI/CD pipeline** — `prisma migrate deploy` in the deployment pipeline handles schema updates automatically
