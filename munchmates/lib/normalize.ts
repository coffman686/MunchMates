import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import nlp from "compromise"

type NFKDSanitizedItem = string;
type NLPProcessedItem = string;
type CanonicalName = string;

// load ingredients aliases
const aliasData = await loadJsonBr("./data/aliases.json.br")

// load additional food centric words
const wordData = await loadJsonBr("./data/words.json.br")

// add to NLP for slighly better processing
nlp.addWords(wordData);

async function loadJsonBr(file: string) {
  const chunks: Buffer[]  = [];

  // pipe stream into decompressor and output chunks
  await pipeline(
    createReadStream(file),
    createBrotliDecompress(),
    async function* (stream) {
      for await (const chunk of stream) {
        chunks.push(chunk);
        yield
      }
    }
  )

  const buffer = Buffer.concat(chunks).toString()
  return JSON.parse(buffer)
}

export function smashed_case(item: NFKDSanitizedItem): NFKDSanitizedItem {
  // Remove all remaining whitespace
  const whitespace = /\s/g;
  return item.toLocaleLowerCase().toLocaleLowerCase().replaceAll(whitespace, "");
}


export function sanitize(item: string): NFKDSanitizedItem {
  return item.normalize("NFKD").trim();
}

export function process(item: string): NLPProcessedItem {
  // processing performs as much NLP-based normalization as possible
  // depluralization, deconstructing adjectives and verbs, etc
  const processed = nlp(item).normalize("heavy").text();

  // smash
  const key = smashed_case(processed);

  // check alias mapping for existing mapping
  // can be extended later if i get better data
  const aliased = aliasData[key];

  if (aliased) {
    return aliased
  }

  return item
}

export function canonical(item: NLPProcessedItem): CanonicalName {
  // Resolves issues with characters mapping to an intermediary that were missed during the NFKC processing
  const lowercase: string = item.toLocaleLowerCase().toLocaleLowerCase();

  // Convert all remaining consecutive whitespace characters into single spaces
  const whitespace = /\s+/g;
  const snakecase = lowercase.replaceAll(whitespace, " ");

  return snakecase;
}

export function normalize(raw: string): CanonicalName {
  // run normalization flow
  const sanitized = sanitize(raw);
  const searched = process(sanitized);
  const canonicalized = canonical(searched);

  return canonicalized;
}
