import { google, customsearch_v1 } from "googleapis";

export interface SearchResult {
  title: string;
  url: string;
}

export interface Searcher {
  search(
    searchTerm: string,
    options?: { maxResults: number }
  ): Promise<SearchResult[]>;
}

export class GoogleSearcher implements Searcher {
  private readonly customSearch: customsearch_v1.Customsearch;
  private readonly apiKey: string;
  private readonly cx: string;

  constructor(apiKey: string, cx: string) {
    this.customSearch = google.customsearch("v1");
    this.apiKey = apiKey;
    this.cx = cx;
  }

  async search(
    searchTerm: string,
    options?: { maxResults: number }
  ): Promise<SearchResult[]> {
    try {
      const maxResults = options?.maxResults || 1;
      const result = await this.customSearch.cse.list({
        auth: this.apiKey,
        cx: this.cx,
        q: searchTerm,
        num: Math.min(maxResults, 10), // Google CSE API limits to 10 results per request
      });

      if (!result.data.items) {
        return [];
      }

      return result.data.items.map((item) => ({
        title: item.title || "",
        url: item.link || "",
      }));
    } catch (error) {
      console.error("Google search error:", error);
      throw error;
    }
  }
}
