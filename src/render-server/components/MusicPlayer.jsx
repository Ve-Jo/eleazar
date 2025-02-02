const MusicPlayer = (props) => {
  let {
    i18n,
    currentSong,
    previousSong,
    nextSongs,
    queueLength,
    currentTime,
    duration,
    userAvatar,
    width = 525,
    height = 200,
  } = props;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(MusicPlayer.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  // Convert milliseconds to seconds for currentTime and duration
  const currentTimeSeconds = Math.floor(currentTime / 1000);
  const durationSeconds = Math.floor(duration / 1000);

  const formatTime = (totalSeconds) => {
    if (!totalSeconds) return "0:00";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Example variables with no images
  const exampleCurrentSong = {
    title: "Example Song Long Name",
    artist: "Artist Name",
    duration: 271,
  };

  // Use provided values or fallback to example values
  currentSong = currentSong || exampleCurrentSong;
  previousSong = previousSong;
  nextSongs = nextSongs;
  queueLength = (queueLength || (nextSongs ? nextSongs.length : 0)) + 1;
  currentTime = currentTime || 32;
  duration = duration || currentSong.duration;

  const renderSongThumbnails = (previousSong, nextSongs) => {
    if (!previousSong && (!nextSongs || nextSongs.length === 0)) {
      return null;
    }

    const allSongs = previousSong
      ? [previousSong, ...(nextSongs || []).slice(0, 4)]
      : (nextSongs || []).slice(0, 5);
    const thumbnailWidth = 120;
    const overlap = 35;

    return allSongs.map((song, index) => {
      const isPrevious = previousSong && index === 0;
      let leftOffset = 0;

      // Convert duration from milliseconds to seconds
      const durationInSeconds = Math.floor(song.duration / 1000);

      if (previousSong && nextSongs && nextSongs.length <= 5) {
        leftOffset = index * (thumbnailWidth - overlap);
      } else {
        if (nextSongs) {
          leftOffset =
            width -
            (allSongs.length - index + (6 - nextSongs.length)) *
              (thumbnailWidth - overlap) -
            15;
        }
      }

      const opacity = isPrevious ? 0.3 : 1;

      return (
        <div
          key={index}
          style={{
            width: `${thumbnailWidth}px`,
            height: "80px",
            position: "absolute",
            left: `${leftOffset}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: opacity,
          }}
        >
          <div
            style={{
              width: "100px",
              height: "50px",
              borderRadius: "10px",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: song.thumbnail ? "transparent" : "#2f3136",
            }}
          >
            {song.thumbnail ? (
              <img
                src={song.thumbnail}
                alt={`${song.title} thumbnail`}
                width={100}
                height={50}
                style={{
                  objectFit: "cover",
                  borderRadius: "10px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#2f3136",
                  borderRadius: "10px",
                }}
              />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              top: "-8px",
              left: "3px",
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#1e2124",
            }}
          >
            {song.user?.avatarURL ? (
              <img
                src={song.user.avatarURL}
                alt={`${song.user.username} avatar`}
                width={30}
                height={30}
                style={{
                  objectFit: "cover",
                  borderRadius: "10px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#1e2124",
                  borderRadius: "8px",
                }}
              />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "0",
              left: "10px",
              width: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.0)",
              color: "white",
              padding: "4px",
              fontSize: "10px",
              borderRadius: "0 0 10px 10px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {song.title}
            </span>
            <span style={{ display: "flex" }}>
              {formatTime(durationInSeconds)}
            </span>
          </div>
        </div>
      );
    });
  };

  const progressPercentage = (currentTime / duration) * 100;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "20px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#2f3136",
      }}
    >
      {/* Background */}
      {currentSong.thumbnail && (
        <img
          src={currentSong.thumbnail}
          alt="Background"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "20px",
            opacity: 1,
          }}
        />
      )}

      {/* Overlay to ensure text readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: currentSong.thumbnail
            ? "rgba(0, 0, 0, 0.4)"
            : "transparent",
        }}
      />

      <div
        style={{
          padding: "15px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Current Song */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {currentSong.title}
            </div>
            <div
              style={{
                fontSize: "18px",
                opacity: 0.8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "flex",
              }}
            >
              {currentSong.artist}
            </div>
          </div>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "12px",
              overflow: "hidden",
              marginLeft: "15px",
              display: "flex",
              backgroundColor: "#1e2124",
            }}
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="User Avatar"
                width={60}
                height={60}
                style={{
                  objectFit: "cover",
                  borderRadius: "15px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#1e2124",
                  borderRadius: "12px",
                }}
              />
            )}
          </div>
        </div>

        {/* Queue */}
        <div
          style={{
            height: "80px",
            position: "relative",
            display: "flex",
            marginBottom: "15px",
          }}
        >
          {renderSongThumbnails(previousSong, nextSongs)}

          {/* More songs indicator */}
          {queueLength > 5 && (
            <div
              style={{
                fontSize: "14px",
                backgroundColor: "rgba(255, 255, 255, 0.5)",
                padding: "4px 8px",
                borderRadius: "10px",
                display: "flex",
                height: "45px",
                position: "absolute",
                right: "-5px",
                bottom: "32px",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              +{queueLength - 6 + (previousSong ? 1 : 0)}{" "}
              {translations.moreItems}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          height: "25px",
          backgroundColor: "rgba(255, 255, 255, 0.3)",
          borderRadius: "0 0 20px 20px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "0 15px",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "0",
            top: "0",
            bottom: "0",
            width: `${progressPercentage}%`,
            backgroundColor: "white",
            borderRadius: "0 0 0 20px",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            zIndex: "1",
            fontSize: "14px",
          }}
        >
          <span style={{ color: "rgba(0, 0, 0, 0.5)", display: "flex" }}>
            {formatTime(currentTimeSeconds)}
          </span>
          <span style={{ color: "rgba(0, 0, 0, 0.5)", display: "flex" }}>
            {formatTime(durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Static translations object that will be synchronized
MusicPlayer.localization_strings = {
  queue: {
    en: "Queue",
    ru: "Очередь",
    uk: "Черга",
  },
  moreItems: {
    en: "more items",
    ru: "ещё треков",
    uk: "ще треків",
  },
  nowPlaying: {
    en: "Now Playing",
    ru: "Сейчас играет",
    uk: "Зараз грає",
  },
};

export default MusicPlayer;
