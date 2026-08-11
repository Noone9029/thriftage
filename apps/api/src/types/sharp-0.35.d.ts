// sharp 0.35 ships declarations but omits the `types` condition from its package exports.
// Keep this narrow compatibility surface until upstream exports resolve under NodeNext.
declare module 'sharp' {
  interface Metadata {
    readonly format?: string;
    readonly height?: number;
    readonly pages?: number;
    readonly width?: number;
  }

  interface Sharp {
    jpeg(): Sharp;
    metadata(): Promise<Metadata>;
    resize(
      width: number,
      height: number,
      options:
        | { readonly fit: 'cover'; readonly position: 'attention' }
        | { readonly fit: 'inside'; readonly withoutEnlargement: boolean },
    ): Sharp;
    rotate(): Sharp;
    toBuffer(): Promise<Buffer>;
    webp(options: { readonly quality: number }): Sharp;
  }

  interface SharpFactory {
    (
      input: Buffer,
      options?: { readonly failOn?: 'warning'; readonly limitInputPixels?: number },
    ): Sharp;
    (input: {
      readonly create: {
        readonly background: string;
        readonly channels: 3 | 4;
        readonly height: number;
        readonly width: number;
      };
    }): Sharp;
  }

  const sharp: SharpFactory;
  export default sharp;
}
