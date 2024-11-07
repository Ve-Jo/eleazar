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

  while (true) {
    try {
      const locale = props.locale || "en";

      if (props.database?.banner_url) {
        console.log(
          "Sending request with banner URL:",
          props.database.banner_url
        );
      }

      const sanitizedProps = JSON.parse(
        JSON.stringify({ ...props, locale }, (key, value) => {
          if (typeof value === "bigint") {
            return value.toString();
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
