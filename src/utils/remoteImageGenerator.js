import axios from "axios";

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1500;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateRemoteImage(
  componentName,
  props,
  config,
  scaling
) {
  let retries = 0;

  const serverUrl = process.env.IMAGE_SERVER_URL || "http://localhost:3002";
  console.log("🔄 Using render server at:", serverUrl);

  // Validate banner URL if present
  if (props.database?.banner_url) {
    try {
      const response = await axios.head(props.database.banner_url);
      if (!response.headers["content-type"]?.startsWith("image/")) {
        console.error(
          "Invalid banner content type:",
          response.headers["content-type"]
        );
        props.database.banner_url = null; // Clear invalid banner URL
      }
    } catch (error) {
      console.error("Error validating banner URL:", error);
      props.database.banner_url = null; // Clear inaccessible banner URL
    }
  }

  while (true) {
    try {
      const locale = props.locale || "en";

      // Clean up props before sending
      const sanitizedProps = JSON.parse(
        JSON.stringify({ ...props, locale }, (key, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }
          // Remove null or undefined banner_url
          if (key === "banner_url" && !value) {
            return undefined;
          }
          return value;
        })
      );

      console.log(
        "Sending request with props:",
        JSON.stringify(sanitizedProps, null, 2)
      );

      const response = await axios.post(
        `${serverUrl}/generate`,
        {
          componentName,
          props: sanitizedProps,
          config,
          scaling,
        },
        {
          responseType: "arraybuffer",
          headers: {
            Accept: "image/gif,image/png",
          },
        }
      );

      console.log("Response headers:", response.headers);

      const contentType =
        response.headers["content-type"] || response.headers["x-image-type"];
      console.log("Detected content type:", contentType);

      const finalContentType =
        contentType === "image/gif" ? "image/gif" : "image/png";
      console.log("Final content type:", finalContentType);

      return {
        buffer: Buffer.from(response.data),
        contentType: finalContentType,
      };
    } catch (error) {
      retries++;

      console.error("Request error:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      }

      if (retries > MAX_RETRIES) {
        console.error(
          "Max retries reached. Error generating remote image:",
          error
        );
        throw error;
      }

      const backoffDelay =
        retries === 1 ? 2000 : INITIAL_DELAY * Math.pow(2, retries - 1);
      console.log(
        `Attempt ${retries} failed, retrying in ${
          backoffDelay / 1000
        } seconds...`
      );

      await delay(backoffDelay);
    }
  }
}
