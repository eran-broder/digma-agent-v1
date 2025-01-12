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
