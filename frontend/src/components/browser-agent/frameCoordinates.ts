export type ViewportBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const mapClientPointToFrame = (
  clientX: number,
  clientY: number,
  bounds: ViewportBounds,
  frameWidth: number,
  frameHeight: number,
) => {
  if (bounds.width <= 0 || bounds.height <= 0 || frameWidth <= 0 || frameHeight <= 0) return null;
  const scale = Math.min(bounds.width / frameWidth, bounds.height / frameHeight);
  const renderedWidth = frameWidth * scale;
  const renderedHeight = frameHeight * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  const renderedX = clientX - bounds.left - offsetX;
  const renderedY = clientY - bounds.top - offsetY;
  if (renderedX < 0 || renderedY < 0 || renderedX >= renderedWidth || renderedY >= renderedHeight) return null;
  return {
    x: Math.min(frameWidth - 1, renderedX / scale),
    y: Math.min(frameHeight - 1, renderedY / scale),
  };
};
