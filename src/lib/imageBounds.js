function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * Returns the pixel rectangle occupied by an object-fit: contain image or
 * video. Pass either `naturalWidth/Height` (intrinsic media size, in CSS
 * pixels for the media itself) OR `displayWidth/Height` (the actual rendered
 * rectangle the media occupies inside the container, in container pixels).
 *
 * Prefer `displayWidth/Height` when available — for camera streams on mobile,
 * the intrinsic dimensions can be landscape (e.g. 1920×1080) while the element
 * is rendered portrait, and intrinsic-only containment will produce a band
 * that does not match what the user sees on screen.
 *
 * All returned values are relative to the containing visual frame.
 */
export function getContainedImageBounds({
  containerWidth,
  containerHeight,
  naturalWidth,
  naturalHeight,
  displayWidth,
  displayHeight,
}) {
  if (![containerWidth, containerHeight].every(isPositiveFinite)) {
    return null;
  }

  // 1. If caller provides the actual rendered rect, trust it. This is the
  //    most accurate path for <video> because object-fit: contain has already
  //    computed the layout box by the time we run.
  if ([displayWidth, displayHeight].every(isPositiveFinite)) {
    return {
      left: 0,
      top: 0,
      width: Math.min(displayWidth, containerWidth),
      height: Math.min(displayHeight, containerHeight),
    };
  }

  // 2. Fall back to intrinsic dimensions. Note: for camera streams this can
  //    disagree with the rendered rect (portrait vs. landscape rotation), so
  //    callers should prefer the displayWidth/Height path.
  if (![naturalWidth, naturalHeight].every(isPositiveFinite)) {
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
