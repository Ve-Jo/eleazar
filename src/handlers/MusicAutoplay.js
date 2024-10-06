export default async function autoPlayFunction(player, previousTrack) {
  console.log("Autoplay function called");

  console.log(`CURRENT AUTOPLAY STATUS: ${player.get("autoplay_enabled")}`);

  //if its undefined, return
  if (!player.get("autoplay_enabled")) {
    console.log("Autoplay is disabled, returning");
    return;
  }
  if (!previousTrack) {
    console.log("No previous track, returning");
    return;
  }

  if (previousTrack.info.sourceName === "spotify") {
    console.log("TRYING TO FIND SPOTIFY SONGS");
    const filtered = player.queue.previous
      .filter((v) => v.info.sourceName === "spotify")
      .slice(0, 5);
    const ids = filtered.map(
      (v) =>
        v.info.identifier ||
        v.info.uri.split("/")?.reverse()?.[0] ||
        v.info.uri.split("/")?.reverse()?.[1]
    );

    let res;
    if (ids.length >= 2) {
      res = await player
        .search(
          {
            query: `seed_tracks=${ids.join(",")}`,
            source: "sprec",
          },
          previousTrack.requester
        )
        .then((response) => {
          response.tracks = response.tracks.filter(
            (v) => v.info.identifier !== previousTrack.info.identifier
          );
          return response;
        })
        .catch((error) => {
          console.warn("Error searching with Spotify recommendations:", error);
          return null;
        });
    }

    // If the Spotify recommendation search fails or there aren't enough IDs, try a regular search
    if (!res || res.loadType === "error" || res.tracks.length === 0) {
      console.log(
        "Spotify recommendation search failed or not enough tracks, trying regular search"
      );
      res = await player
        .search(
          {
            query: `${previousTrack.info.author} ${previousTrack.info.title}`,
            source: "ytmsearch", // Using YouTube Music search as a fallback
          },
          previousTrack.requester
        )
        .catch(console.warn);
    }

    if (res && res.tracks.length) {
      console.log("TRYING TO ADD SPOTIFY SONGS");
      await player.queue.add(
        res.tracks.slice(1, 6).map((track) => {
          // Start from index 1 to skip the first track
          track.pluginInfo.clientData = {
            ...(track.pluginInfo.clientData || {}),
            fromAutoplay: true,
          };
          return track;
        })
      );
    } else {
      console.log("No tracks found for Spotify autoplay");
    }
    return;
  }
  if (
    previousTrack.info.sourceName === "youtube" ||
    previousTrack.info.sourceName === "youtubemusic"
  ) {
    console.log("TRYING TO FIND SONGS");
    let res;

    // First, try searching with the mix URL
    res = await player
      .search(
        {
          query: `https://www.youtube.com/watch?v=${previousTrack.info.identifier}&list=RD${previousTrack.info.identifier}`,
          source: "youtube",
        },
        previousTrack.requester
      )
      .catch((error) => {
        console.warn("Error searching with mix URL:", error);
        return null;
      });

    // If the mix URL search fails, try a regular search
    if (!res || res.loadType === "error" || res.tracks.length === 0) {
      console.log("Mix URL search failed, trying regular search");
      res = await player
        .search(
          {
            query: previousTrack.info.title,
            source: "youtube",
          },
          previousTrack.requester
        )
        .catch(console.warn);
    }

    if (res && res.tracks.length > 1) {
      // Check if there's more than one track
      console.log("TRYING TO ADD SONGS");
      await player.queue.add(
        res.tracks.slice(1, 6).map((track) => {
          // Start from index 1 to skip the first track
          track.pluginInfo.clientData = {
            ...(track.pluginInfo.clientData || {}),
            fromAutoplay: true,
          };
          return track;
        })
      );
    } else {
      console.log("No tracks found for autoplay or only one track returned");
    }
    return;
  }
  return;
}
