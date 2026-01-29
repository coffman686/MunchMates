# MunchMates - Requirements Ideas (Iteration 2)

Brainstorm ideas for the next iteration. Not organized - just collecting thoughts.

---

## High Priority / Infrastructure

- **Database setup** - Currently using in-memory storage and localStorage. Data resets on server restart. Need PostgreSQL or MongoDB.
- **Caching layer** - No caching for Spoonacular API calls. Should cache search results, recipe details. Redis?
- **Move shared collections to database** - Currently using file-based JSON storage

---

## Recipe & Search Features

- **Pantry intersection search** - Search for recipes that can be made with ONLY what's in your pantry (not just "includes these ingredients")
- **"What can I make?" button** - One-click to find recipes from current pantry items
- **Better ingredient matching** - Normalize ingredient names (e.g., "chicken breast" vs "boneless chicken breast")
- **Recipe scaling** - Adjust servings and have ingredient amounts update automatically
- **Unit conversion** - Toggle between metric and imperial

---

## Nutrition & Health

- **Macro tracking** - Spoonacular already has nutrition data, we just don't use it
- **Daily/weekly nutrition summary** - Show calories, protein, carbs, fat for planned meals
- **Dietary goals** - Set personal targets and track against them
- **Allergen warnings** - More prominent display of allergens on recipe cards

---

## Shopping & Grocery

- **Grocery store API integration** - Instacart? Kroger? Amazon Fresh? Auto-add items to cart
- **Price tracking** - Estimate cost of grocery list
- **Store aisle mapping** - Organize grocery list by store section
- **Quantity consolidation** - When generating list from meal plan, combine duplicate ingredients properly (2 recipes with "1 cup flour" = "2 cups flour")

---

## Pantry Improvements

- **Auto-deduct from pantry** - When you "cook" a recipe, subtract ingredients from pantry
- **Low stock alerts** - Notify when staples are running low
- **Barcode scanning** - Scan products to add to pantry
- **Expiry notifications** - Push notifications for items about to expire

---

## Social / Community

- **Real backend for community** - Currently mock data only
- **Recipe sharing** - Share to social media or generate shareable links
- **User ratings & reviews** - Rate recipes, leave comments
- **Follow other users** - See what friends are cooking
- **Recipe import** - Import from URLs (AllRecipes, Food Network, etc.)

---

## Meal Planning

- **Meal prep mode** - Batch cooking support, multiply recipes
- **Leftover tracking** - Mark meals as "leftovers from X"
- **Recurring meals** - "Taco Tuesday" type scheduling
- **Meal plan templates** - Save and reuse weekly plans
- **Calendar sync** - Export to Google Calendar / Apple Calendar

---

## Notifications & Reminders

- **Push notifications** - Browser/mobile notifications
- **Email digests** - Weekly meal plan summary
- **Meal prep reminders** - "Start marinating chicken for tomorrow's dinner"
- **Grocery reminder** - "Your grocery list has 12 items"

---

## Technical Debt / Quality

- **Add tests** - No unit tests, integration tests, or E2E tests currently
- **API documentation** - No Swagger/OpenAPI docs
- **Rate limiting** - Protect API endpoints
- **Better error handling** - Many silent failures currently
- **Image upload** - Let users upload custom recipe photos

---

## Nice to Have / Future

- **Recipe recommendations** - ML-based suggestions based on history
- **Voice commands** - "Hey MunchMates, what's for dinner?"
- **Offline mode** - PWA with offline recipe access
- **Multi-language support** - i18n
- **Dark mode** - (might already have this?)
- **Print recipe** - Printer-friendly recipe format
- **Cooking timer integration** - Built-in timers for recipe steps

---

## CI/CD Development

- **Basic CI/CD workflow** - Have a basic pipeline from commit -> deployment once we get all the hosting figured out (can use GitHub actions)

---

## Questions to Answer

- What database? PostgreSQL vs MongoDB vs Supabase?
- Self-hosted vs cloud? (Vercel Postgres, PlanetScale, etc.)
- Which grocery API is most accessible?
- Do we want real-time features? (WebSockets for shared collections)
