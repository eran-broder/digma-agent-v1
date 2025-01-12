import { zeroShotRunner } from "../ai/zero-shot-runner.js";
import {
  Analysis,
  BaseAnalysis,
  baseAnalysisSchema,
  Query,
} from "./schemas.js";
import { dedent } from "ts-dedent";
import { format } from "pretty-format";
import { ensure, omitKey } from "../ai/utils.js";
import { Searcher, SearchResult } from "src/search/types.js";

export async function analyze(body: {
  input: Query;
  searcher: Searcher;
}): Promise<Analysis> {
  const baseAnalysis = await generateBaseAnalysis(body.input);
  const allSearchTerms = extractAllSearchTerms(baseAnalysis);
  const searchResults = await performSearches(allSearchTerms, body.searcher);
  return enrichAnalysisWithSources(baseAnalysis, searchResults);
}

async function generateBaseAnalysis(input: Query): Promise<BaseAnalysis> {
  const prompt = createAnalysisPrompt(input);
  const system = "Be very detailed and thorough in your analysis.";

  return await zeroShotRunner({
    apiKey: input.apiKey,
    system,
    message: prompt,
    resultSchema: baseAnalysisSchema,
  });
}

function createAnalysisPrompt(input: Query): string {
  const formattedInput = formatInput(input);
  return dedent`
    Here is a json, describing an issue I have with a query:
    ${formattedInput}
    I wish you analyze it and provide me with a list of recommendations, according to the given schema.`;
}

function formatInput(input: Query): string {
  return dedent`
    Query:
    ${format(omitKey(input, "apiKey"))}
  `;
}

function normalizeSearchTerm(term: string): string {
  return term.toLowerCase().trim();
}

function extractAllSearchTerms(analysis: BaseAnalysis): Set<string> {
  const terms = new Set<string>();
  analysis.recommendations.forEach((rec) => {
    rec.searchTerms.forEach((term) => {
      terms.add(normalizeSearchTerm(term));
    });
  });
  return terms;
}

async function performSearches(
  searchTerms: Set<string>,
  searcher: Searcher
): Promise<Map<string, SearchResult[]>> {
  const searchResults = new Map<string, SearchResult[]>();

  await Promise.all(
    Array.from(searchTerms).map(async (term) => {
      try {
        const results = await searcher.search(term, { maxResults: 5 });
        searchResults.set(term, results);
      } catch (error) {
        console.error(`Search failed for term "${term}":`, error);
        searchResults.set(term, []);
      }
    })
  );

  return searchResults;
}

function enrichAnalysisWithSources(
  analysis: BaseAnalysis,
  searchResults: Map<string, SearchResult[]>
): Analysis {
  function matchingResults(searchTerms: string[]): SearchResult[] {
    const seenUrls = new Set<string>();
    const uniqueResults: SearchResult[] = [];

    searchTerms.forEach((term) => {
      const normalizedTerm = normalizeSearchTerm(term);
      const results = searchResults.get(normalizedTerm) || [];

      results.forEach((result) => {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          uniqueResults.push(result);
        }
      });
    });

    return uniqueResults;
  }

  return {
    recommendations: analysis.recommendations.map((rec) => ({
      ...rec,
      sources: matchingResults(rec.searchTerms),
    })),
  };
}
