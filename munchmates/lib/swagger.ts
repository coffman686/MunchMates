import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
    const spec = createSwaggerSpec({
        apiFolder: "app/api",
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Munch Mates API",
                version: "1.0.0",
                description:
                    "API documentation for Munch Mates — an intelligent meal planning and recipe management application.",
                contact: {
                    name: "Team 17 — EECS 582 Capstone",
                },
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local development server",
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                        description: "Keycloak JWT access token",
                    },
                },
                schemas: {
                    UserProfile: {
                        type: "object",
                        properties: {
                            favoriteCuisines: { type: "string", example: "Italian, Mexican" },
                            diets: { type: "array", items: { type: "string" }, example: ["vegetarian"] },
                            intolerances: { type: "array", items: { type: "string" }, example: ["gluten"] },
                            dailyCalorieGoal: { type: "integer", nullable: true, example: 2000 },
                            dailyProteinGoal: { type: "integer", nullable: true, example: 150 },
                            dailyCarbGoal: { type: "integer", nullable: true, example: 250 },
                            dailyFatGoal: { type: "integer", nullable: true, example: 65 },
                        },
                    },
                    MeProfile: {
                        type: "object",
                        properties: {
                            favoriteCuisines: { type: "string" },
                            diets: { type: "array", items: { type: "string" } },
                            intolerances: { type: "array", items: { type: "string" } },
                        },
                    },
                    GroceryItem: {
                        type: "object",
                        properties: {
                            id: { type: "integer" },
                            name: { type: "string" },
                            quantity: { type: "string", nullable: true },
                            category: { type: "string" },
                            completed: { type: "boolean" },
                            fromMealPlan: { type: "boolean" },
                            addedAt: { type: "string", format: "date-time" },
                        },
                    },
                    GroceryCategory: {
                        type: "object",
                        properties: {
                            id: { type: "integer" },
                            name: { type: "string" },
                            sortOrder: { type: "integer" },
                        },
                    },
                    PantryItem: {
                        type: "object",
                        properties: {
                            id: { type: "integer" },
                            name: { type: "string" },
                            canonName: { type: "string" },
                            quantity: { type: "string" },
                            amount: { type: "number", nullable: true },
                            unit: { type: "string" },
                            category: { type: "string" },
                            expiryDate: { type: "string", format: "date", nullable: true },
                            addedAt: { type: "string", format: "date" },
                        },
                    },
                    SavedRecipe: {
                        type: "object",
                        properties: {
                            userId: { type: "string" },
                            recipeId: { type: "integer" },
                            recipeName: { type: "string" },
                            recipeImage: { type: "string", nullable: true },
                            savedAt: { type: "string", format: "date-time" },
                        },
                    },
                    MacroTotals: {
                        type: "object",
                        properties: {
                            calories: { type: "integer" },
                            protein: { type: "integer" },
                            carbs: { type: "integer" },
                            fat: { type: "integer" },
                        },
                    },
                    MealPlanEntry: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            recipeId: { type: "integer" },
                            title: { type: "string" },
                            image: { type: "string" },
                            servings: { type: "integer" },
                            originalServings: { type: "integer" },
                            readyInMinutes: { type: "integer" },
                        },
                    },
                    DayPlan: {
                        type: "object",
                        properties: {
                            date: { type: "string", format: "date" },
                            breakfast: { $ref: "#/components/schemas/MealPlanEntry" },
                            lunch: { $ref: "#/components/schemas/MealPlanEntry" },
                            dinner: { $ref: "#/components/schemas/MealPlanEntry" },
                        },
                    },
                    WeeklyMealPlan: {
                        type: "object",
                        properties: {
                            weekStart: { type: "string", format: "date" },
                            days: {
                                type: "array",
                                items: { $ref: "#/components/schemas/DayPlan" },
                            },
                        },
                    },
                },
            },
            security: [{ bearerAuth: [] }],

            tags: [
                { name: "Account", description: "User account management" },
                { name: "Admin", description: "Admin-only endpoints" },
                { name: "Profile", description: "User profile and preferences (Prisma-backed)" },
                { name: "Me", description: "User preferences (in-memory, legacy)" },
                { name: "Grocery", description: "Grocery list management" },
                { name: "Grocery Categories", description: "Custom grocery categories" },
                { name: "Grocery Import", description: "Import ingredients from meal plan" },
                { name: "Meal Plan", description: "Weekly meal plan CRUD" },
                { name: "Nutrition Summary", description: "Daily nutrition totals for meal plans" },
                { name: "Pantry", description: "Pantry inventory management" },
                { name: "Pantry Match", description: "Match recipe ingredients against pantry" },
                { name: "Pantry Deduct", description: "Deduct ingredient amounts after cooking" },
                { name: "Custom Recipes", description: "Create and manage custom recipes" },
                { name: "Saved Recipes", description: "Save and unsave recipes" },
                { name: "Recipe Search", description: "Search recipes via Spoonacular" },
                { name: "Recipe Info", description: "Fetch recipe details and nutrition" },
                { name: "Shared Collections", description: "Shared recipe collections" },
                { name: "Collection Details", description: "Single collection management" },
                { name: "Collection Members", description: "Manage collection members" },
                { name: "Upload", description: "File uploads for recipe images" },
                { name: "Users", description: "User search" },
            ],

            paths: {
                // ─── Account ──────────────────────────────────────────
                "/api/account": {
                    delete: {
                        tags: ["Account"],
                        summary: "Delete user account",
                        description: "Deletes the authenticated user's Keycloak account.",
                        responses: {
                            200: {
                                description: "Account deleted",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: { ok: { type: "boolean", example: true } },
                                        },
                                    },
                                },
                            },
                            400: { description: "No user id in token" },
                            401: { description: "Unauthorized" },
                        },
                    },
                },

                // ─── Admin ────────────────────────────────────────────
                "/api/admin": {
                    get: {
                        tags: ["Admin"],
                        summary: "Admin-only endpoint",
                        description: "Returns a secret message. Requires `admin` role in JWT.",
                        responses: {
                            200: {
                                description: "Admin access granted",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                secret: { type: "string", example: "Admin zone unlocked ✨" },
                                            },
                                        },
                                    },
                                },
                            },
                            403: { description: "Forbidden — missing admin role" },
                        },
                    },
                },

                // ─── Profile (Prisma-backed) ─────────────────────────
                "/api/profile": {
                    get: {
                        tags: ["Profile"],
                        summary: "Get user profile",
                        description:
                            "Returns the authenticated user's profile including dietary preferences and nutrition goals.",
                        responses: {
                            200: {
                                description: "User profile",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/UserProfile" },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Profile"],
                        summary: "Update user profile",
                        description: "Creates or updates the user profile (upsert).",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/UserProfile" },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Profile updated",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                profile: { $ref: "#/components/schemas/UserProfile" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─── Me (in-memory legacy) ───────────────────────────
                "/api/me": {
                    get: {
                        tags: ["Me"],
                        summary: "Get user preferences (legacy)",
                        description:
                            "Returns in-memory user preferences (cuisines, diets, intolerances). Not persisted across restarts.",
                        responses: {
                            200: {
                                description: "User preferences",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/MeProfile" },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Me"],
                        summary: "Update user preferences (legacy)",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/MeProfile" },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Preferences updated",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                profile: { $ref: "#/components/schemas/MeProfile" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─── Grocery Items ───────────────────────────────────
                "/api/grocery": {
                    get: {
                        tags: ["Grocery"],
                        summary: "List grocery items",
                        description: "Returns all grocery items for the authenticated user.",
                        responses: {
                            200: {
                                description: "Grocery list",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                items: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/GroceryItem" },
                                                },
                                                count: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Grocery"],
                        summary: "Add grocery item",
                        description:
                            "Adds a new grocery item or updates an existing one with the same name (upsert).",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name", "category"],
                                        properties: {
                                            name: { type: "string", example: "Chicken breast" },
                                            quantity: { type: "string", example: "2 lbs", nullable: true },
                                            category: { type: "string", example: "Meat & Seafood" },
                                            fromMealPlan: { type: "boolean", default: false },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Item added or updated",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                message: { type: "string" },
                                                item: { $ref: "#/components/schemas/GroceryItem" },
                                            },
                                        },
                                    },
                                },
                            },
                            400: { description: "Missing required fields" },
                        },
                    },
                    put: {
                        tags: ["Grocery"],
                        summary: "Update grocery item",
                        description:
                            "Updates a grocery item's name, quantity, category, or completed status.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["id"],
                                        properties: {
                                            id: { type: "integer" },
                                            name: { type: "string" },
                                            quantity: { type: "string", nullable: true },
                                            category: { type: "string" },
                                            completed: { type: "boolean" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Item updated" },
                            400: { description: "Missing id" },
                            404: { description: "Item not found" },
                        },
                    },
                    delete: {
                        tags: ["Grocery"],
                        summary: "Delete grocery item",
                        parameters: [
                            {
                                name: "id",
                                in: "query",
                                required: true,
                                schema: { type: "integer" },
                                description: "Grocery item ID",
                            },
                        ],
                        responses: {
                            200: { description: "Item deleted" },
                            400: { description: "Missing or invalid id" },
                            404: { description: "Item not found" },
                        },
                    },
                },

                // ─── Grocery Clear ───────────────────────────────────
                "/api/grocery/clear": {
                    post: {
                        tags: ["Grocery"],
                        summary: "Bulk clear grocery items",
                        description:
                            'Clear completed items or the entire list. Action must be "completed" or "all".',
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["action"],
                                        properties: {
                                            action: {
                                                type: "string",
                                                enum: ["completed", "all"],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Items cleared",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                message: { type: "string" },
                                                deletedCount: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                            400: { description: "Invalid action" },
                        },
                    },
                },

                // ─── Grocery Categories ──────────────────────────────
                "/api/grocery/categories": {
                    get: {
                        tags: ["Grocery Categories"],
                        summary: "List grocery categories",
                        description:
                            "Returns user's custom grocery categories. Seeds defaults on first call.",
                        responses: {
                            200: {
                                description: "Category list",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                categories: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/GroceryCategory" },
                                                },
                                                count: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Grocery Categories"],
                        summary: "Add a grocery category",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name"],
                                        properties: {
                                            name: { type: "string", example: "Snacks" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Category added" },
                            400: { description: "Missing name" },
                            409: { description: "Category already exists" },
                        },
                    },
                    delete: {
                        tags: ["Grocery Categories"],
                        summary: "Delete a grocery category",
                        description:
                            "Removes a category and reassigns its items to the first remaining category.",
                        parameters: [
                            {
                                name: "name",
                                in: "query",
                                required: true,
                                schema: { type: "string" },
                            },
                        ],
                        responses: {
                            200: {
                                description: "Category deleted",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                message: { type: "string" },
                                                reassignedTo: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                            404: { description: "Category not found" },
                        },
                    },
                },

                // ─── Grocery Import ──────────────────────────────────
                "/api/grocery/import": {
                    post: {
                        tags: ["Grocery Import"],
                        summary: "Import ingredients from meal plan",
                        description:
                            "Aggregates meal-plan ingredients into the grocery list. Filters out items already in pantry. Merges quantities for existing grocery items.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["items"],
                                        properties: {
                                            items: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        totalAmount: { type: "number" },
                                                        unit: { type: "string" },
                                                        category: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Import results",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                message: { type: "string" },
                                                addedCount: { type: "integer" },
                                                updatedCount: { type: "integer" },
                                                filteredCount: { type: "integer" },
                                                totalProcessed: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─── Meal Plan ───────────────────────────────────────
                "/api/meal-plan": {
                    get: {
                        tags: ["Meal Plan"],
                        summary: "Get weekly meal plan",
                        description: "Returns the meal plan for a given week, or null if none exists.",
                        parameters: [
                            {
                                name: "weekStart",
                                in: "query",
                                required: true,
                                schema: { type: "string", format: "date" },
                                description: "Start date of the week (YYYY-MM-DD)",
                                example: "2026-04-06",
                            },
                        ],
                        responses: {
                            200: {
                                description: "Meal plan (or null)",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                plan: {
                                                    nullable: true,
                                                    $ref: "#/components/schemas/WeeklyMealPlan",
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            400: { description: "Missing weekStart" },
                        },
                    },
                    post: {
                        tags: ["Meal Plan"],
                        summary: "Save weekly meal plan",
                        description:
                            "Creates or replaces the meal plan for a given week (transactional upsert).",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["plan"],
                                        properties: {
                                            plan: { $ref: "#/components/schemas/WeeklyMealPlan" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Plan saved" },
                            400: { description: "Invalid meal plan data" },
                        },
                    },
                },

                // ─── Nutrition Summary ───────────────────────────────
                "/api/meal-plan/nutrition-summary": {
                    get: {
                        tags: ["Nutrition Summary"],
                        summary: "Get nutrition summary for a week",
                        description:
                            "Returns daily macro totals and progress vs. user goals for each day in the meal plan.",
                        parameters: [
                            {
                                name: "weekStart",
                                in: "query",
                                required: true,
                                schema: { type: "string", format: "date" },
                            },
                        ],
                        responses: {
                            200: {
                                description: "Daily nutrition breakdown",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                days: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            date: { type: "string" },
                                                            totals: { $ref: "#/components/schemas/MacroTotals" },
                                                            goals: { type: "object" },
                                                            progress: { type: "object" },
                                                            meals: { type: "array", items: { type: "object" } },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            400: { description: "Missing weekStart" },
                        },
                    },
                },

                // ─── Pantry ──────────────────────────────────────────
                "/api/pantry": {
                    get: {
                        tags: ["Pantry"],
                        summary: "List pantry items",
                        responses: {
                            200: {
                                description: "Pantry inventory",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                items: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/PantryItem" },
                                                },
                                                count: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Pantry"],
                        summary: "Add pantry item",
                        description:
                            "Adds a new pantry item. Accepts structured amount+unit or legacy quantity string. Deduplicates by canonical name.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name", "category"],
                                        properties: {
                                            name: { type: "string", example: "Eggs" },
                                            quantity: { type: "string", example: "12 large" },
                                            amount: { type: "number", example: 12, nullable: true },
                                            unit: { type: "string", example: "large" },
                                            category: { type: "string", example: "Dairy" },
                                            expiryDate: {
                                                type: "string",
                                                format: "date",
                                                nullable: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Item added or updated" },
                            400: { description: "Missing required fields" },
                        },
                    },
                    put: {
                        tags: ["Pantry"],
                        summary: "Update pantry item",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["id"],
                                        properties: {
                                            id: { type: "integer" },
                                            name: { type: "string" },
                                            quantity: { type: "string" },
                                            amount: { type: "number", nullable: true },
                                            unit: { type: "string" },
                                            category: { type: "string" },
                                            expiryDate: { type: "string", format: "date", nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Item updated" },
                            404: { description: "Item not found" },
                        },
                    },
                    delete: {
                        tags: ["Pantry"],
                        summary: "Delete pantry item",
                        parameters: [
                            {
                                name: "id",
                                in: "query",
                                required: true,
                                schema: { type: "integer" },
                            },
                        ],
                        responses: {
                            200: { description: "Item deleted" },
                            404: { description: "Item not found" },
                        },
                    },
                },

                // ─── Pantry Match ────────────────────────────────────
                "/api/pantry/match": {
                    post: {
                        tags: ["Pantry Match"],
                        summary: "Match ingredients against pantry",
                        description:
                            "Compares recipe ingredients to pantry inventory. Returns matched/partial/unmatched status with fuzzy name matching and unit conversion.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["ingredients"],
                                        properties: {
                                            ingredients: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        amount: { type: "number" },
                                                        unit: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Match results",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                matches: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            ingredientIndex: { type: "integer" },
                                                            ingredientName: { type: "string" },
                                                            status: {
                                                                type: "string",
                                                                enum: ["matched", "partial", "unmatched"],
                                                            },
                                                            pantryItem: { type: "object", nullable: true },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─── Pantry Deduct ───────────────────────────────────
                "/api/pantry/deduct": {
                    post: {
                        tags: ["Pantry Deduct"],
                        summary: "Deduct ingredients from pantry",
                        description:
                            "Subtracts ingredient amounts after cooking. Removes items that reach zero. Handles unit conversion.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["deductions"],
                                        properties: {
                                            deductions: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    required: ["pantryItemId", "amount", "unit"],
                                                    properties: {
                                                        pantryItemId: { type: "integer" },
                                                        amount: { type: "number" },
                                                        unit: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Deduction results",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                results: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            pantryItemId: { type: "integer" },
                                                            action: { type: "string", enum: ["updated", "removed"] },
                                                            remainingAmount: { type: "number" },
                                                            remainingUnit: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─── Custom Recipes ──────────────────────────────────
                "/api/recipes/create": {
                    get: {
                        tags: ["Custom Recipes"],
                        summary: "Get custom recipes",
                        description:
                            "With `?id=`: returns a single custom recipe (no auth). Without: returns all recipes for the authenticated user.",
                        parameters: [
                            {
                                name: "id",
                                in: "query",
                                required: false,
                                schema: { type: "integer" },
                                description: "Optional recipe ID for single lookup (no auth required)",
                            },
                        ],
                        responses: {
                            200: { description: "Recipe(s) returned" },
                            404: { description: "Recipe not found" },
                        },
                    },
                    post: {
                        tags: ["Custom Recipes"],
                        summary: "Create a custom recipe",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["title", "ingredients", "instructions"],
                                        properties: {
                                            title: { type: "string" },
                                            servings: { type: "integer", default: 1 },
                                            readyInMinutes: { type: "integer", default: 30 },
                                            dishTypes: { type: "array", items: { type: "string" } },
                                            cuisines: { type: "array", items: { type: "string" } },
                                            ingredients: { type: "array", items: { type: "string" } },
                                            instructions: { type: "string" },
                                            image: { type: "string", nullable: true },
                                            summary: { type: "string", nullable: true },
                                            structuredIngredients: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        amount: { type: "number" },
                                                        unit: { type: "string" },
                                                        original: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            201: { description: "Recipe created" },
                            400: { description: "Validation error" },
                        },
                    },
                    delete: {
                        tags: ["Custom Recipes"],
                        summary: "Delete a custom recipe",
                        parameters: [
                            {
                                name: "id",
                                in: "query",
                                required: true,
                                schema: { type: "integer" },
                            },
                        ],
                        responses: {
                            200: { description: "Recipe deleted" },
                            404: { description: "Recipe not found" },
                        },
                    },
                },

                // ─── Saved Recipes ───────────────────────────────────
                "/api/recipes/saved": {
                    get: {
                        tags: ["Saved Recipes"],
                        summary: "List saved recipes",
                        responses: {
                            200: {
                                description: "Saved recipe list",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                recipes: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/SavedRecipe" },
                                                },
                                                count: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    post: {
                        tags: ["Saved Recipes"],
                        summary: "Save a recipe",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["recipeId", "recipeName"],
                                        properties: {
                                            recipeId: { type: "integer" },
                                            recipeName: { type: "string" },
                                            recipeImage: { type: "string", nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            201: { description: "Recipe saved" },
                            200: { description: "Recipe already saved" },
                            400: { description: "Missing fields" },
                        },
                    },
                    delete: {
                        tags: ["Saved Recipes"],
                        summary: "Unsave a recipe",
                        parameters: [
                            {
                                name: "recipeId",
                                in: "query",
                                required: true,
                                schema: { type: "integer" },
                            },
                        ],
                        responses: {
                            200: { description: "Recipe removed" },
                            404: { description: "Not found in saved recipes" },
                        },
                    },
                },

                // ─── Spoonacular Proxies ─────────────────────────────
                "/api/spoonacular/recipes/autocomplete": {
                    get: {
                        tags: ["Recipe Search"],
                        summary: "Autocomplete recipe names",
                        parameters: [
                            { name: "query", in: "query", required: true, schema: { type: "string" } },
                            { name: "number", in: "query", schema: { type: "integer", default: 7 } },
                        ],
                        responses: {
                            200: { description: "Autocomplete suggestions" },
                            400: { description: "Missing query" },
                        },
                    },
                },
                "/api/spoonacular/recipes/generateMealPlan": {
                    get: {
                        tags: ["Meal Plan"],
                        summary: "Generate meal plan via Spoonacular",
                        parameters: [
                            {
                                name: "timeFrame",
                                in: "query",
                                schema: { type: "string", enum: ["day", "week"], default: "week" },
                            },
                            { name: "targetCalories", in: "query", schema: { type: "integer" } },
                            { name: "diet", in: "query", schema: { type: "string" } },
                            { name: "exclude", in: "query", schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Generated meal plan" },
                        },
                    },
                },
                "/api/spoonacular/recipes/popular": {
                    get: {
                        tags: ["Recipe Search"],
                        summary: "Get popular recipes",
                        description: "Fetches trending recipes for the dashboard carousel.",
                        parameters: [
                            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
                        ],
                        responses: {
                            200: { description: "Popular recipes" },
                        },
                    },
                },
                "/api/recipes/searchByIngredient": {
                    get: {
                        tags: ["Recipe Search"],
                        summary: "Search recipes by ingredients or keyword",
                        parameters: [
                            { name: "ingredients", in: "query", schema: { type: "string" }, description: "Comma-separated ingredient list" },
                            { name: "query", in: "query", schema: { type: "string" } },
                            { name: "cuisine", in: "query", schema: { type: "string" } },
                            { name: "dishType", in: "query", schema: { type: "string" } },
                            { name: "diet", in: "query", schema: { type: "string" } },
                            { name: "intolerances", in: "query", schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Search results sorted by ingredient match" },
                            400: { description: "Missing ingredients or query" },
                        },
                    },
                },
                "/api/recipes/info": {
                    get: {
                        tags: ["Recipe Info"],
                        summary: "Get recipe information",
                        description: "Fetches full recipe details from Spoonacular. Normalizes ingredient names for pantry matching.",
                        parameters: [
                            { name: "id", in: "query", required: true, schema: { type: "integer" } },
                        ],
                        responses: {
                            200: { description: "Recipe details" },
                            400: { description: "Missing id" },
                        },
                    },
                },
                "/api/recipes/information": {
                    get: {
                        tags: ["Recipe Info"],
                        summary: "Get recipe information (alternate)",
                        description: "Same as /api/recipes/info but includes 402 handling for API limit.",
                        parameters: [
                            { name: "id", in: "query", required: true, schema: { type: "integer" } },
                        ],
                        responses: {
                            200: { description: "Recipe details" },
                            400: { description: "Missing id" },
                            402: { description: "Spoonacular API daily limit reached" },
                        },
                    },
                },
                "/api/recipes/nutrition": {
                    get: {
                        tags: ["Recipe Info"],
                        summary: "Get recipe nutrition",
                        parameters: [
                            { name: "id", in: "query", required: true, schema: { type: "integer" } },
                        ],
                        responses: {
                            200: { description: "Nutrition data (calories, protein, carbs, fat)" },
                            400: { description: "Missing or invalid id" },
                        },
                    },
                },
                "/api/recipes/searchRecipeInstructions": {
                    get: {
                        tags: ["Recipe Info"],
                        summary: "Get recipe instructions",
                        parameters: [
                            { name: "id", in: "query", required: true, schema: { type: "integer" } },
                        ],
                        responses: {
                            200: { description: "Step-by-step instructions" },
                            400: { description: "Missing id" },
                        },
                    },
                },

                // ─── Shared Collections ──────────────────────────────
                "/api/shared-collections": {
                    get: {
                        tags: ["Shared Collections"],
                        summary: "List user's collections",
                        description: "Returns all collections the user is a member of.",
                        responses: {
                            200: { description: "Collection list" },
                        },
                    },
                    post: {
                        tags: ["Shared Collections"],
                        summary: "Create a collection",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name"],
                                        properties: {
                                            name: { type: "string" },
                                            description: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            201: { description: "Collection created" },
                            400: { description: "Name required" },
                        },
                    },
                    delete: {
                        tags: ["Shared Collections"],
                        summary: "Delete a collection (owner only)",
                        parameters: [
                            { name: "collectionId", in: "query", required: true, schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Collection deleted" },
                            403: { description: "Not the owner" },
                            404: { description: "Collection not found" },
                        },
                    },
                },

                "/api/shared-collections/{id}": {
                    get: {
                        tags: ["Collection Details"],
                        summary: "Get a collection by ID",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Collection details" },
                            403: { description: "Not a member" },
                            404: { description: "Not found" },
                        },
                    },
                    put: {
                        tags: ["Collection Details"],
                        summary: "Update collection or manage recipes",
                        description:
                            'Actions: "update" (name/description), "addRecipe", "removeRecipe".',
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["action"],
                                        properties: {
                                            action: { type: "string", enum: ["update", "addRecipe", "removeRecipe"] },
                                            name: { type: "string" },
                                            description: { type: "string" },
                                            recipeId: { type: "integer" },
                                            recipeName: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Collection updated" },
                            400: { description: "Invalid action or missing fields" },
                            403: { description: "No edit permission" },
                        },
                    },
                    delete: {
                        tags: ["Collection Details"],
                        summary: "Leave or delete collection",
                        description: "Owner deletes the collection; non-owner leaves it.",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Left or deleted" },
                            403: { description: "Not a member" },
                        },
                    },
                },

                "/api/shared-collections/{id}/members": {
                    post: {
                        tags: ["Collection Members"],
                        summary: "Add a member",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["memberId", "memberName"],
                                        properties: {
                                            memberId: { type: "string" },
                                            memberName: { type: "string" },
                                            role: { type: "string", enum: ["editor", "viewer"], default: "viewer" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Member added (or already exists)" },
                            400: { description: "Missing fields or user not found" },
                            403: { description: "No permission" },
                        },
                    },
                    put: {
                        tags: ["Collection Members"],
                        summary: "Update member role",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["memberId", "role"],
                                        properties: {
                                            memberId: { type: "string" },
                                            role: { type: "string", enum: ["editor", "viewer"] },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Role updated" },
                            403: { description: "Only owner can change roles" },
                        },
                    },
                    delete: {
                        tags: ["Collection Members"],
                        summary: "Remove a member",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                            { name: "memberId", in: "query", required: true, schema: { type: "string" } },
                        ],
                        responses: {
                            200: { description: "Member removed" },
                            403: { description: "Only owner can remove members" },
                        },
                    },
                },

                // ─── Upload ──────────────────────────────────────────
                "/api/upload": {
                    post: {
                        tags: ["Upload"],
                        summary: "Upload a recipe image",
                        description: "Accepts JPEG, PNG, WebP, or GIF up to 5 MB. Returns the public URL.",
                        requestBody: {
                            required: true,
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            file: { type: "string", format: "binary" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "Upload successful",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                ok: { type: "boolean" },
                                                url: { type: "string", example: "/uploads/recipes/abc123.jpg" },
                                            },
                                        },
                                    },
                                },
                            },
                            400: { description: "No file, wrong type, or too large" },
                        },
                    },
                },

                // ─── Users Search ────────────────────────────────────
                "/api/users/search": {
                    get: {
                        tags: ["Users"],
                        summary: "Search users by name or username",
                        description: "Returns up to 10 matching users. Minimum 2-character query. Excludes the requesting user.",
                        parameters: [
                            {
                                name: "q",
                                in: "query",
                                required: true,
                                schema: { type: "string", minLength: 2 },
                                description: "Search query (name or username)",
                            },
                        ],
                        responses: {
                            200: {
                                description: "Matching users",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                users: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            id: { type: "string" },
                                                            name: { type: "string" },
                                                            username: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    return spec;
};