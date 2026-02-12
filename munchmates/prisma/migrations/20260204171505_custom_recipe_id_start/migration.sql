-- Set CustomRecipe auto-increment to start at 100000
-- Avoids ID conflicts with Spoonacular recipe IDs used throughout the frontend

ALTER SEQUENCE "CustomRecipe_id_seq" RESTART WITH 100000;
