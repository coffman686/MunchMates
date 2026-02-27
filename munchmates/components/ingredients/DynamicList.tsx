// DynamicList.tsx
// List that supports a dynamic number of items and several views (list, ship, etc)
// Paired with Autosuggest to provide ingredient display and input component
// - Completes items from presupplied list of ingredients and currently selected items
// - Provides additional dropdowns grocery list and pantry items (fetched via API)

import { useState, useEffect, useCallback } from "react";
import Autosuggest from "./Autosuggest";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dispatch, SetStateAction, ReactNode } from "react";
import { XIcon, ShoppingCart, Package } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { authedFetch } from "@/lib/authedFetch";

interface GroceryItem {
  id: number;
  name: string;
  category: string;
  completed: boolean;
  quantity?: string;
}

interface PantryItem {
  id: number;
  name: string;
  quantity: string;
  category: string;
  expiryDate?: string | null;
  addedAt: string;
}

const data = [
  // Produce - Fruits
  "Apple",
  "Banana",
  "Orange",
  "Lemon",
  "Lime",
  "Grapefruit",
  "Strawberry",
  "Blueberry",
  "Raspberry",
  "Blackberry",
  "Grape",
  "Watermelon",
  "Cantaloupe",
  "Honeydew",
  "Pineapple",
  "Mango",
  "Peach",
  "Nectarine",
  "Plum",
  "Pear",
  "Kiwi",
  "Pomegranate",
  "Cherry",
  "Apricot",
  "Cranberry",
  "Fig",
  "Date",

  // Produce - Vegetables
  "Broccoli",
  "Cauliflower",
  "Carrot",
  "Celery",
  "Cucumber",
  "Zucchini",
  "Yellow Squash",
  "Butternut Squash",
  "Acorn Squash",
  "Pumpkin",
  "Sweet Potato",
  "Russet Potato",
  "Red Potato",
  "Yukon Gold Potato",
  "Onion",
  "Red Onion",
  "Yellow Onion",
  "White Onion",
  "Green Onion",
  "Shallot",
  "Garlic",
  "Ginger",
  "Bell Pepper",
  "Red Bell Pepper",
  "Yellow Bell Pepper",
  "Green Bell Pepper",
  "Orange Bell Pepper",
  "Jalapeño",
  "Serrano Pepper",
  "Habanero Pepper",
  "Poblano Pepper",
  "Tomato",
  "Cherry Tomato",
  "Grape Tomato",
  "Roma Tomato",
  "Spinach",
  "Kale",
  "Romaine Lettuce",
  "Iceberg Lettuce",
  "Mixed Greens",
  "Arugula",
  "Cabbage",
  "Red Cabbage",
  "Brussels Sprouts",
  "Asparagus",
  "Green Beans",
  "Snow Peas",
  "Snap Peas",
  "Mushroom",
  "Portobello Mushroom",
  "Cremini Mushroom",
  "White Mushroom",
  "Eggplant",
  "Beet",
  "Radish",
  "Leek",
  "Fennel",
  "Corn",

  // Fresh Herbs
  "Basil",
  "Cilantro",
  "Parsley",
  "Flat-Leaf Parsley",
  "Mint",
  "Rosemary",
  "Thyme",
  "Oregano",
  "Dill",
  "Chives",
  "Sage",
  "Tarragon",
  "Bay Leaf",

  // Meat & Seafood
  "Chicken Breast",
  "Chicken Thigh",
  "Ground Chicken",
  "Whole Chicken",
  "Turkey Breast",
  "Ground Turkey",
  "Pork Chop",
  "Pork Loin",
  "Ground Pork",
  "Bacon",
  "Sausage",
  "Beef Steak",
  "Sirloin Steak",
  "Ribeye Steak",
  "Ground Beef",
  "Beef Roast",
  "Lamb Chops",
  "Ground Lamb",
  "Salmon",
  "Tilapia",
  "Cod",
  "Shrimp",
  "Scallops",
  "Tuna",
  "Sardines",
  "Crab",
  "Lobster",

  // Dairy & Eggs
  "Whole Milk",
  "2% Milk",
  "Skim Milk",
  "Buttermilk",
  "Heavy Cream",
  "Half and Half",
  "Yogurt",
  "Greek Yogurt",
  "Sour Cream",
  "Cream Cheese",
  "Cottage Cheese",
  "Butter",
  "Unsalted Butter",
  "Salted Butter",
  "Ghee",
  "Parmesan Cheese",
  "Cheddar Cheese",
  "Mozzarella Cheese",
  "Fresh Mozzarella",
  "Feta Cheese",
  "Goat Cheese",
  "Swiss Cheese",
  "Provolone Cheese",
  "Monterey Jack Cheese",
  "Pepper Jack Cheese",
  "Blue Cheese",
  "Egg",
  "Egg White",
  "Egg Yolk",

  // Plant-Based Milks & Proteins
  "Almond Milk",
  "Soy Milk",
  "Oat Milk",
  "Coconut Milk",
  "Coconut Cream",
  "Tofu",
  "Firm Tofu",
  "Extra Firm Tofu",
  "Silken Tofu",
  "Tempeh",
  "Seitan",
  "Textured Vegetable Protein",

  // Grains, Pasta & Bakery
  "White Rice",
  "Brown Rice",
  "Basmati Rice",
  "Jasmine Rice",
  "Quinoa",
  "Couscous",
  "Bulgur",
  "Farro",
  "Barley",
  "Oats",
  "Rolled Oats",
  "Steel-Cut Oats",
  "White Bread",
  "Whole Wheat Bread",
  "Sourdough Bread",
  "Bagel",
  "Tortilla",
  "Flour Tortilla",
  "Corn Tortilla",
  "Pita Bread",
  "Naan",
  "Hamburger Bun",
  "Hot Dog Bun",
  "Spaghetti",
  "Penne",
  "Macaroni",
  "Fettuccine",
  "Lasagna Noodles",
  "Egg Noodles",
  "Ramen Noodles",
  "Rice Noodles",
  "Udon Noodles",

  // Baking & Pantry Basics
  "All-Purpose Flour",
  "Whole Wheat Flour",
  "Bread Flour",
  "Cornmeal",
  "Baking Powder",
  "Baking Soda",
  "Yeast",
  "Granulated Sugar",
  "Brown Sugar",
  "Powdered Sugar",
  "Honey",
  "Maple Syrup",
  "Agave Nectar",
  "Vanilla Extract",
  "Cocoa Powder",
  "Chocolate Chips",

  // Canned & Jarred
  "Canned Tomatoes",
  "Diced Tomatoes",
  "Tomato Sauce",
  "Tomato Paste",
  "Crushed Tomatoes",
  "Canned Corn",
  "Canned Black Beans",
  "Canned Pinto Beans",
  "Canned Kidney Beans",
  "Canned Chickpeas",
  "Canned Lentils",
  "Canned Tuna",
  "Canned Salmon",
  "Canned Coconut Milk",
  "Marinara Sauce",
  "Salsa",
  "Peanut Butter",
  "Almond Butter",
  "Jam",
  "Jelly",
  "Pickle",
  "Olives",

  // Oils, Vinegars & Condiments
  "Olive Oil",
  "Extra Virgin Olive Oil",
  "Vegetable Oil",
  "Canola Oil",
  "Avocado Oil",
  "Sesame Oil",
  "Soy Sauce",
  "Tamari",
  "Fish Sauce",
  "Oyster Sauce",
  "Worcestershire Sauce",
  "Hot Sauce",
  "Sriracha",
  "Ketchup",
  "Mustard",
  "Dijon Mustard",
  "Mayonnaise",
  "BBQ Sauce",
  "Ranch Dressing",
  "Vinaigrette",
  "Balsamic Vinegar",
  "Red Wine Vinegar",
  "White Wine Vinegar",
  "Rice Vinegar",
  "Apple Cider Vinegar",

  // Spices & Seasonings
  "Salt",
  "Sea Salt",
  "Kosher Salt",
  "Black Pepper",
  "White Pepper",
  "Paprika",
  "Smoked Paprika",
  "Cayenne Pepper",
  "Chili Powder",
  "Cumin",
  "Coriander",
  "Turmeric",
  "Curry Powder",
  "Garlic Powder",
  "Onion Powder",
  "Italian Seasoning",
  "Herbes De Provence",
  "Dried Oregano",
  "Dried Basil",
  "Dried Thyme",
  "Dried Rosemary",
  "Red Pepper Flakes",
  "Cinnamon",
  "Nutmeg",
  "Cloves",
  "Ground Ginger",
  "Allspice",

  // Legumes, Nuts & Seeds
  "Lentils",
  "Green Lentils",
  "Red Lentils",
  "Black Beans",
  "Pinto Beans",
  "Kidney Beans",
  "Chickpeas",
  "White Beans",
  "Cannellini Beans",
  "Edamame",
  "Peanuts",
  "Almonds",
  "Walnuts",
  "Cashews",
  "Pistachios",
  "Pumpkin Seeds",
  "Sunflower Seeds",
  "Chia Seeds",
  "Flaxseed",
  "Hemp Seeds",

  // Snacks & Misc
  "Granola",
  "Cereal",
  "Crackers",
  "Pretzels",
  "Popcorn Kernels",
  "Tortilla Chips",
  "Potato Chips",
  "Hummus",
  "Guacamole",

  // Beverages / Stocks
  "Water",
  "Sparkling Water",
  "Orange Juice",
  "Apple Juice",
  "Lemon Juice",
  "Lime Juice",
  "Coffee",
  "Espresso",
  "Tea",
  "Green Tea",
  "Black Tea",
  "Herbal Tea",
  "Broth",
  "Chicken Broth",
  "Beef Broth",
  "Vegetable Broth",

  // Common Prepared Items
  "Yogurt Parfait",
  "Granola Bar",
  "Oatmeal",
  "Salad Mix",
  "Coleslaw Mix",
  "Frozen Vegetables",
  "Frozen Berries",
  "Frozen Pizza",
  "Frozen Fries"
];


type IngredientListProps = {
  ingredients: string[];
  setIngredients: Dispatch<SetStateAction<string[]>>;
  children?: ReactNode;   // ← new
};


export default function IngredientList({
                                         ingredients,
                                         setIngredients,
                                         children,
                                       }: IngredientListProps) {
  const [query, setQuery] = useState("");
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

  // Fetch grocery list from API
  const loadGroceryList = useCallback(async () => {
    try {
      const res = await authedFetch('/api/grocery');
      if (res.ok) {
        const data = await res.json();
        setGroceryItems(data.items || []);
      }
    } catch {
      setGroceryItems([]);
    }
  }, []);

  // Fetch pantry items from API
  const loadPantryItems = useCallback(async () => {
    try {
      const res = await authedFetch('/api/pantry');
      if (res.ok) {
        const data = await res.json();
        setPantryItems(data.items || []);
      }
    } catch {
      setPantryItems([]);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadGroceryList();
    loadPantryItems();
  }, [loadGroceryList, loadPantryItems]);

  // Get unique, non-completed grocery items that aren't already in the ingredients list
  const availableGroceryItems = groceryItems
    .filter(item => !item.completed && !ingredients.includes(item.name))
    .map(item => item.name);

  // Get pantry items that aren't already in the ingredients list
  const availablePantryItems = pantryItems
    .filter(item => !ingredients.includes(item.name))
    .map(item => item.name);

  // TODO: replace, needed for testing
  const addIngredient = (item: string) => {
    if (item.trim() !== "" && !ingredients.includes(item)) {
      setIngredients((prevIngredients) => [...prevIngredients, item]);
    }
  };

  const handleAddFromGroceryList = (itemName: string) => {
    if (itemName && itemName !== "placeholder") {
      addIngredient(itemName);
    }
  };

  const handleAddFromPantry = (itemName: string) => {
    if (itemName && itemName !== "placeholder") {
      addIngredient(itemName);
    }
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      addIngredient(query);
      setQuery("");
    }
  };

  // TODO: replace, needed for testing
  const handleDeleteIngredient = (index: number) => {
    setIngredients((prevIngredients) =>
      prevIngredients.filter((_, i) => i !== index),
    );
  };

  const addAllPantryItems = () => {
    const newItems = pantryItems
      .map(item => item.name)
      .filter(name => !ingredients.includes(name));
    setIngredients(prev => [...prev, ...newItems]);
  }

  const clearIngredients = () => {
    setIngredients([]);
  }
  return (
      <div className="flex-1 max-w-3xl">
        <ul>
          {ingredients.map((ingredient, index) => (
              <li key={ingredient}>
                <Badge
                    className="justify-between"
                >
                  {ingredient}
                  <Button
                      type="button"
                      variant="ghost"
                      className="size-6 p-0 rounded-full"
                      onClick={() => handleDeleteIngredient(index)}
                  >
                    <XIcon className="inline justify-center"/>
                  </Button>
                </Badge>
              </li>
          ))}
        </ul>

        <form className="relative mt-4 space-y-3" onSubmit={handleAddIngredient}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Autosuggest
                  data={[...data, ...ingredients]}
                  query={query}
                  setQuery={setQuery}
              />
            </div>

            {/* Pantry Dropdown */}
            {availablePantryItems.length > 0 && (
              <Select onValueChange={handleAddFromPantry}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <SelectValue placeholder="From pantry" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availablePantryItems.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Grocery List Dropdown */}
            {availableGroceryItems.length > 0 && (
              <Select onValueChange={handleAddFromGroceryList}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <SelectValue placeholder="From grocery list" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableGroceryItems.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              Add ingredient
            </Button>

            <Button
                type="button"
                onClick={clearIngredients}
            >
              Clear List
            </Button>

            <Button
              type="button"
              onClick={() => addAllPantryItems()}
              className="inline-flex items-center gap-2"
            >
                What Can I Make?
            </Button>

            {children}
          </div>
        </form>
      </div>
  );
}
