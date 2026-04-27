// Dietary.tsx
// Dialog for selecting user diet and allergens/intolerances.
// Controlled component — parent owns state and persists via /api/profile.

"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";
import { Button } from "../ui/button";

const allDiets = [
  "Gluten Free",
  "Ketogenic",
  "Vegetarian",
  "Lacto-Vegetarian",
  "Ovo-Vegetarian",
  "Vegan",
  "Pescetarian",
  "Paleo",
  "Primal",
  "Low FODMAP",
  "Whole30",
];

const allIntolerances = [
  "Dairy",
  "Egg",
  "Gluten",
  "Grain",
  "Peanut",
  "Seafood",
  "Sesame",
  "Shellfish",
  "Soy",
  "Sulfite",
  "Tree Nut",
  "Wheat",
];

type DietaryDialogProps = {
  isOpen: boolean;
  closePopup: (e: React.SyntheticEvent) => void;
  diets: string[];
  setDiets: Dispatch<SetStateAction<string[]>>;
  intolerances: string[];
  setIntolerances: Dispatch<SetStateAction<string[]>>;
};

export function DietaryDialog({
  isOpen,
  closePopup,
  diets,
  setDiets,
  intolerances,
  setIntolerances,
}: DietaryDialogProps) {
  // save preferences on update
  useEffect(() => {
    const localDiets = localStorage.getItem("diets");
    if (localDiets) {
      setDiets(JSON.parse(localDiets));
    }

    const localIntolerances = localStorage.getItem("intolerances");
    if (localIntolerances) {
      setIntolerances(JSON.parse(localIntolerances));
    }
  }, [setDiets, setIntolerances]);

  // initialize data from local storage
  useEffect(() => {
    localStorage.setItem("diets", JSON.stringify(diets));
    localStorage.setItem("intolerances", JSON.stringify(intolerances));
  }, [diets, intolerances]);

  // add or remove an item from preferences on user selection
  function toggleItem(item: string, setItems: Dispatch<SetStateAction<string[]>>) {
    setItems((prevItems: string[]) => {
      if (prevItems.includes(item)) {
        return prevItems.filter((sel) => sel !== item);
      } else {
        return [...prevItems, item];
      }
    });
  }

  function ChipGrid(items: string[], selected: string[], toggleFunc: (item: string) => void) {
    // return `w-fit rounded-md p-1 m-1 hover:brightness-90 ${color()}`;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, _) => {
          const active = selected.includes(item);
          return (
            <button
              type="button"
              key={item}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground/70 hover:bg-muted"
              }`}
              onClick={() => toggleFunc(item)}
            >
              {item}
            </button>
          );
        })}
      </div>
    );
  }

  if (!isOpen) {
    return;
  }

  return (
    <div className="dietaryprefs">
      <div className="fixed inset-1 flex justify-center items-center z-50">
        <div className="bg-popover p-6 rounded-lg shadow-lg w-1/2 content-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="border-solid mb-4 md:mb-0 ">
              <h2 className="mb-2">Diets</h2>
              {ChipGrid(allDiets, diets, (c) => toggleItem(c, setDiets))}
            </div>
            <div>
              <h2 className="mb-2">Intolerances</h2>
              {ChipGrid(allIntolerances, intolerances, (c) => toggleItem(c, setIntolerances))}
            </div>
          </div>
          <div className="flex justify-center">
            <Button onClick={closePopup}>Save and close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// get diets from local storage
export function getDiets() {
  const localDiets = localStorage.getItem("diets");
  if (localDiets) {
    return JSON.parse(localDiets).join(",");
  }
}

// get intolerances from local storage
export function getIntolerances() {
  const localIntolerances = localStorage.getItem("intolerances");
  if (localIntolerances) {
    return JSON.parse(localIntolerances).join(",");
  }
}
