type SearchResultTrack = {
  encoded?: string;
  title?: string;
  info?: {
    sourceName?: string;
    title?: string;
    author?: string;
  };
  requester?: unknown;
};

type PlayerSearchResult = {
  tracks?: SearchResultTrack[];
};

type PlayerLike = {
  search: (query: { query: string; source: string }) => Promise<PlayerSearchResult>;
};

async function findAlternativeTrack(
  player: PlayerLike,
  searchQuery: string,
  originalSource = "youtube"
): Promise<SearchResultTrack | null> {
  console.log(`Searching for "${searchQuery}" across multiple platforms`);

  const sources = ["scsearch", "dzsearch", "deezer", "soundcloud", "ytmsearch"].filter(
    (source) => !source.includes(originalSource)
  );

  for (const source of sources) {
    try {
      console.log(`Trying search with source: ${source}`);
      const results = await player
        .search({
          query: searchQuery,
          source,
        })
        .catch(() => null);

      if (results?.tracks?.length) {
        console.log(`Found ${results.tracks.length} tracks using ${source}`);
        return results.tracks[0] || null;
      }
    } catch (error) {
      console.error(`Error searching with ${source}:`, error);
    }
  }

  return null;
}

export type { SearchResultTrack, PlayerSearchResult, PlayerLike };
export { findAlternativeTrack };
