/**
 * Reads an image file and scales it down to fit `max` pixels, returned as a
 * JPEG data URL small enough for browser storage. If the first result is still
 * larger than `maxKB`, it lowers the quality (then the size) and re-renders
 * until it fits — so a photo straight from a phone camera cannot fill up
 * localStorage, even when the upload to the image bucket is unavailable and the
 * data URL has to be kept on the device.
 */
export function readImage(file: File, max = 512, quality = 0.72, maxKB = 48) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Not an image"));
      image.onload = () => {
        const render = (size: number, q: number) => {
          const scale = Math.min(1, size / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) return String(reader.result);
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/jpeg", q);
        };
        // A base64 data URL holds ~3 bytes for every 4 characters.
        const kb = (url: string) => (url.length * 3) / 4 / 1024;
        let size = max;
        let q = quality;
        let url = render(size, q);
        // Drop the quality first, then the dimensions, until it fits the
        // budget — but never below a usable floor.
        while (kb(url) > maxKB && (q > 0.4 || size > 200)) {
          if (q > 0.4) q = Math.round((q - 0.1) * 100) / 100;
          else size = Math.round(size * 0.8);
          url = render(size, q);
        }
        resolve(url);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
