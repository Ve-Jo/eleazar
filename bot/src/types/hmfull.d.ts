declare module "hmfull" {
  type ImageResult = string | { url?: string };
  type ImageFetcher = () => Promise<ImageResult>;
  type ImageCategoryMap = Record<string, ImageFetcher>;

  const HMFull: {
    HMtai: {
      sfw: ImageCategoryMap;
      nsfw: ImageCategoryMap;
    };
    Nekos: {
      sfw: ImageCategoryMap;
      nsfw: ImageCategoryMap;
    };
    NekoBot: {
      sfw: ImageCategoryMap;
      nsfw: ImageCategoryMap;
    };
    NekoLove: {
      sfw: ImageCategoryMap;
      nsfw: ImageCategoryMap;
    };
  };

  export default HMFull;
}
