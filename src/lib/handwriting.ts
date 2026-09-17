const ALPHA_THRESHOLD = 18;
const EXPORT_SIZE = 1024;
const EXPORT_PADDING = 112;
const EXPORT_INK = 0;

interface InkBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const getInkBounds = (imageData: ImageData): InkBounds | null => {
  const { width, height, data } = imageData;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right === -1 || bottom === -1) return null;

  return { left, top, right, bottom };
};

export const exportCanvasForRecognition = (canvas: HTMLCanvasElement): string | null => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = getInkBounds(source);
  if (!bounds) return null;

  const cropWidth = bounds.right - bounds.left + 1;
  const cropHeight = bounds.bottom - bounds.top + 1;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = EXPORT_SIZE;
  outputCanvas.height = EXPORT_SIZE;

  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) return null;

  outputContext.fillStyle = "white";
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  const monochrome = outputContext.createImageData(cropWidth, cropHeight);

  for (let y = 0; y < cropHeight; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const sourceIndex = ((y + bounds.top) * canvas.width + (x + bounds.left)) * 4;
      const targetIndex = (y * cropWidth + x) * 4;
      const alpha = source.data[sourceIndex + 3];

      if (alpha > ALPHA_THRESHOLD) {
        monochrome.data[targetIndex] = EXPORT_INK;
        monochrome.data[targetIndex + 1] = EXPORT_INK;
        monochrome.data[targetIndex + 2] = EXPORT_INK;
        monochrome.data[targetIndex + 3] = 255;
      } else {
        monochrome.data[targetIndex] = 255;
        monochrome.data[targetIndex + 1] = 255;
        monochrome.data[targetIndex + 2] = 255;
        monochrome.data[targetIndex + 3] = 255;
      }
    }
  }

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = cropWidth;
  inkCanvas.height = cropHeight;
  const inkContext = inkCanvas.getContext("2d");
  if (!inkContext) return null;
  inkContext.putImageData(monochrome, 0, 0);

  const available = EXPORT_SIZE - EXPORT_PADDING * 2;
  const scale = Math.min(available / cropWidth, available / cropHeight, 2.5);
  const drawWidth = Math.max(1, Math.round(cropWidth * scale));
  const drawHeight = Math.max(1, Math.round(cropHeight * scale));
  const drawX = Math.round((EXPORT_SIZE - drawWidth) / 2);
  const drawY = Math.round((EXPORT_SIZE - drawHeight) / 2);
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(inkCanvas, drawX, drawY, drawWidth, drawHeight);
  return outputCanvas.toDataURL("image/png");
};
