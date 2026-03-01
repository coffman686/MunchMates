# alias mapping script for future updates

import re
import json
import unicodedata

with open("./ingredients.txt") as f:
    ingr_dict = {}
    words = []
    strings = ""
    for line in f:
        normalized = unicodedata.normalize("NFKC", line)
        ingrs = normalized.strip().split(",")
        canonical = re.sub(r"\s+", " ", ingrs[0].lower().lower())
        for ingr in ingrs:
            ingr = ingr.strip().lower().lower()
            ingrsquashed = re.sub(r"\s", "", ingr)
            ingr_dict[ingrsquashed] = canonical
            words.extend(ingr.split())

    json.dump(words, open("./words.json", "w"))
    json.dump(ingr_dict, open("ingredients.json", "w"))
