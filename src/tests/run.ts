import { config } from "dotenv";

import { sampleData } from "./test-data.js";
import {
  Analysis,
  analysisSchema,
  BaseAnalysis,
  BaseRecommendation,
  Query,
  querySchema,
  Recommendation,
  Source,
  sourceSchema,
} from "../logic/schemas.js";
import { tavily } from "@tavily/core";
import fs from "fs/promises";
import path from "path";
import { analyze } from "../logic/zero-shot-analyzer.js";
import { GoogleSearcher } from "../search/google.js";
import { Searcher } from "../search/types.js";
import { ensure } from "../ai/utils.js";
import { DummySearcher } from "../search/dummy.js";

// Initialize environment
config();

type RawEntry = {
  query: string;
  instrumentationLibrary?: string;
  ormFramework?: string | null;
};

type ProcessedResult = {
  entry: RawEntry;
  analysis: Analysis;
};

const searchSingle = async (
  searchTerm: string,
  tvly: ReturnType<typeof tavily>
): Promise<Source> => {
  const results = await tvly.search(searchTerm, {
    searchDepth: "advanced",
    maxResults: 1,
  });

  const result = results.results[0];
  return sourceSchema.parse({
    title: result.title,
    url: result.url,
  });
};

const searchAndFormat = async (
  terms: string[],
  tvly: ReturnType<typeof tavily>
): Promise<Source[]> => {
  const results: Source[] = [];
  for (const term of terms) {
    const result = await searchSingle(term, tvly);
    results.push(result);
  }

  return Array.from(
    new Map(results.map((result) => [result.url, result])).values()
  );
};

const enhanceRecommendation = async (
  recommendation: BaseRecommendation,
  tvly: ReturnType<typeof tavily>
): Promise<Recommendation> => {
  const sources = await searchAndFormat(recommendation.searchTerms, tvly);
  return { ...recommendation, sources };
};

const enhanceBaseAnalysis = async (
  baseAnalysis: BaseAnalysis,
  tvly: ReturnType<typeof tavily>
): Promise<Analysis> => {
  const enhanced: Recommendation[] = [];
  for (const rec of baseAnalysis.recommendations) {
    const enhancedRec = await enhanceRecommendation(rec, tvly);
    enhanced.push(enhancedRec);
  }
  return analysisSchema.parse({ recommendations: enhanced });
};

const transformToQuery = (entry: RawEntry, apiKey: string): Query => {
  return querySchema.parse({
    apiKey,
    query: entry.query,
    instrumentationLibrary: entry.instrumentationLibrary || "default",
    ormFramework: entry.ormFramework || null,
  });
};

const processEntry = async (
  rawEntry: RawEntry,
  apiKey: string,
  searcher: Searcher
): Promise<ProcessedResult> => {
  const query = transformToQuery(rawEntry, apiKey);
  const analysis = await analyze({ input: query, searcher });

  return {
    entry: rawEntry,
    analysis,
  };
};

const processEntries = async (
  entries: RawEntry[],
  apiKey: string,
  searcher: Searcher
): Promise<ProcessedResult[]> => {
  const results: ProcessedResult[] = [];
  for (const entry of entries) {
    console.log(`Processing: ${entry.query.substring(0, 50)}...`);
    const result = await processEntry(entry, apiKey, searcher);
    console.log(`Result: ${JSON.stringify(result.analysis, null, 2)}`);
    results.push(result);
  }
  return results;
};

const ensureDirectoryExists = async (filepath: string): Promise<void> => {
  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });
};

const saveResults = async (filepath: string, data: unknown): Promise<void> => {
  await ensureDirectoryExists(filepath);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
};

function getEnvVar(name: string): string {
  return ensure(process.env[name], `Missing environment variable: [${name}]`);
}

function createSearcher(): Searcher {
  /*return new GoogleSearcher(
    ensure(getEnvVar("GOOGLE_SEARCH_API_KEY")),
    ensure(getEnvVar("GOOGLE_CX"))
  );*/
  return new DummySearcher();
}

async function main() {
  const searcher = createSearcher();

  const results = await processEntries(
    sampleData.slice(0, 2),
    getEnvVar("ANTHROPIC_API_KEY"),
    searcher
  );
  await saveResults("c:/t/out.json", results);
  return results;
}

main().then(() => {
  console.log("Processing complete. Results saved to c:/t/out.json");
});
