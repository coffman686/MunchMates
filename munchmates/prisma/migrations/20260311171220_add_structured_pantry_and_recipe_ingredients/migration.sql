-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CustomRecipeIngredient" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "original" TEXT NOT NULL,

    CONSTRAINT "CustomRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomRecipeIngredient" ADD CONSTRAINT "CustomRecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "CustomRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
