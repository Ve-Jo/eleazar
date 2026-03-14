declare module "color-thief-bun" {
  export function getPaletteFromURL(
    imageUrl: string,
    paletteSize?: number,
    quality?: number
  ): Promise<Array<[number, number, number]>>;

  export function getColorFromURL(
    imageUrl: string,
    quality?: number
  ): Promise<[number, number, number]>;
}
