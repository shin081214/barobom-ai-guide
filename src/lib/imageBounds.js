function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * Returns the pixel rectangle occupied by an object-fit: contain image.
 * All returned values are relative to the containing visual frame.
 */
export function getContainedImageBounds({
  containerWidth,
  containerHeight,
  naturalWidth,
  naturalHeight,
}) {
  if (![containerWidth, containerHeight, naturalWidth, naturalHeight].every(isPositiveFinite)) {
    return null;
  }

  const containerRatio = containerWidth / containerHeight;
  const imageRatio = naturalWidth / naturalHeight;

  if (imageRatio > containerRatio) {
    const width = containerWidth;
    const height = width / imageRatio;
    return {
      left: 0,
      top: (containerHeight - height) / 2,
      width,
      height,
    };
  }

  const height = containerHeight;
  const width = height * imageRatio;
  return {
    left: (containerWidth - width) / 2,
    top: 0,
    width,
    height,
  };
}
