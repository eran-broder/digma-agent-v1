import { Searcher, SearchResult } from "./types.js";

export class DummySearcher implements Searcher {
  async search(
    searchTerm: string,
    options: { maxResults: number } = { maxResults: 10 }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const numResults = Math.min(options.maxResults, 20);

    for (let i = 0; i < numResults; i++) {
      results.push({
        title: `Result for ${searchTerm}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(
          searchTerm
        )}`,
      });
    }

    return results;
  }
}
