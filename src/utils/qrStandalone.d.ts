declare const qrCodeEncoder: {
  create: (text: string, options?: { errorCorrectionLevel?: string; version?: number }) => {
    modules: {
      size: number;
      get: (r: number, c: number) => boolean | number;
    };
  };
};
export default qrCodeEncoder;
