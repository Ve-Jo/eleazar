import { setTimeout } from "timers/promises";

type TrackInfo = {
  title: string;
  sourceName: string;
  identifier?: string;
  uri: string;
  author: string;
};

type QueueTrack = {
  info: TrackInfo;
  requester?: unknown;
  pluginInfo?: {
    clientData?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

type SearchQuery = {
  query: string;
  source: string;
};

type SearchResponse = {
  loadType: string;
  tracks: QueueTrack[];
};

type PlayerShape = {
  get: (key: string) => unknown;
  queue: {
    previous: QueueTrack[];
    add: (tracks: QueueTrack[]) => Promise<unknown>;
  };
  search: (query: SearchQuery, requester?: unknown) => Promise<SearchResponse>;
};

async function autoPlayFunction(
  player: PlayerShape,
  previousTrack?: QueueTrack | null
): Promise<QueueTrack[] | null | void> {
  console.log("Autoplay function called");
  console.log(`CURRENT AUTOPLAY STATUS: ${player.get("autoplay_enabled")}`);
  console.log("Previous track:", previousTrack ? previousTrack.info.title : "None");

  if (!player.get("autoplay_enabled")) {
    console.log("Autoplay is disabled, returning");
    return null;
  }

  if (!previousTrack) {
    console.log("No previous track provided, cannot autoplay");
    return null;
  }

  console.log("Previous track source:", previousTrack.info.sourceName);

  let res: SearchResponse | null | undefined;
  const maxRetries = 3;
  const delay = 1000;

  for (let i = 0; i < maxRetries; i += 1) {
    try {
      if (previousTrack.info.sourceName === "spotify") {
        console.log("TRYING TO FIND SPOTIFY SONGS");
        const filtered = player.queue.previous
          .filter((track) => track.info.sourceName === "spotify")
          .slice(0, 5);
        console.log("Filtered Spotify tracks:", filtered.length);
        const ids = filtered.map(
          (track) =>
            track.info.identifier ||
            track.info.uri.split("/").reverse()[0] ||
            track.info.uri.split("/").reverse()[1]
        );
        console.log("Spotify track IDs:", ids);

        if (ids.length >= 2) {
          console.log("Attempting Spotify recommendations search");
          res = await player
            .search(
              {
                query: `seed_tracks=${ids.join(",")}`,
                source: "sprec",
              },
              previousTrack.requester
            )
            .then((response) => {
              console.log(
                "Spotify recommendations response:",
                response.loadType,
                response.tracks.length
              );
              response.tracks = response.tracks.filter(
                (track) => track.info.identifier !== previousTrack.info.identifier
              );
              return response;
            })
            .catch((error) => {
              console.warn("Error searching with Spotify recommendations:", error);
              return null;
            });
        }

        if (!res || res.loadType === "error" || res.tracks.length === 0) {
          console.log(
            "Spotify recommendation search failed or not enough tracks, trying regular search"
          );
          res = await player
            .search(
              {
                query: `${previousTrack.info.author} ${previousTrack.info.title}`,
                source: "ytmsearch",
              },
              previousTrack.requester
            )
            .then((response) => {
              console.log(
                "YouTube Music search response:",
                response.loadType,
                response.tracks.length
              );
              return response;
            })
            .catch((error) => {
              console.warn("Error with YouTube Music search:", error);
              return null;
            });
        }

        if (res && res.tracks.length) {
          console.log("TRYING TO ADD SPOTIFY SONGS");
          const tracksToAdd = res.tracks.slice(1, 6);
          console.log("Tracks to add:", tracksToAdd.length);
          await player.queue.add(
            tracksToAdd.map((track) => {
              track.pluginInfo = track.pluginInfo || {};
              track.pluginInfo.clientData = {
                ...(track.pluginInfo.clientData || {}),
                fromAutoplay: true,
              };
              return track;
            })
          );
          console.log("Added tracks to queue");
        } else {
          console.log("No tracks found for Spotify autoplay");
        }
        return;
      }

      if (
        previousTrack.info.sourceName === "youtube" ||
        previousTrack.info.sourceName === "youtubemusic"
      ) {
        console.log("TRYING TO FIND YOUTUBE SONGS");
        console.log("Attempting related tracks search");
        res = await player.search(
          {
            query: `https://www.youtube.com/watch?v=${previousTrack.info.identifier}`,
            source: "youtube",
          },
          previousTrack.requester
        );
        console.log(
          "Related tracks search response:",
          res.loadType,
          res.tracks.length
        );

        if (!res || res.loadType === "error" || res.tracks.length <= 1) {
          console.log("Related tracks search failed, trying specific search");
          const searchQuery = `${previousTrack.info.author} - ${previousTrack.info.title} type:song`;
          res = await player.search(
            {
              query: searchQuery,
              source: "ytmsearch",
            },
            previousTrack.requester
          );
          console.log(
            "Specific search response:",
            res.loadType,
            res.tracks.length
          );
        }
      }

      if (res && res.tracks.length > 1) {
        break;
      }
    } catch (error) {
      const typedError = error as Error;
      console.warn(`Attempt ${i + 1} failed:`, typedError.message);
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await setTimeout(delay);
      }
    }
  }

  if (res && res.tracks.length > 1) {
    console.log("Autoplay found tracks:", res.tracks.length);
    return res.tracks.slice(1, 6).map((track) => {
      track.pluginInfo = track.pluginInfo || {};
      track.pluginInfo.clientData = {
        ...(track.pluginInfo.clientData || {}),
        fromAutoplay: true,
      };
      return track;
    });
  }

  console.log("No tracks found for autoplay after all attempts");
  return null;
}

export default autoPlayFunction;
