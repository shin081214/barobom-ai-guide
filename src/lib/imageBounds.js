function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * Returns the pixel rectangle occupied by an object-fit: contain image or
 * video, in coordinates relative to the containing visual frame.
 *
 * Two inputs control the calculation:
 *
 *   - `naturalWidth / naturalHeight` are the *intrinsic* media dimensions
 *     (the unscaled pixel size of the still image, or videoWidth/videoHeight
 *     for a running video element).
 *
 *   - `displayWidth / displayHeight` describe the box that the host element
 *     actually occupies after the browser applied object-fit: contain. For a
 *     plain <img>, this matches the element's clientWidth/clientHeight. For
 *     a <video>, it is the element's getBoundingClientRect().
 *
 * Both are optional; if both are provided the rectangle is computed inside
 * the display rect using the intrinsic ratio (mirroring what object-fit:
 * contain does), which correctly accounts for letterbox / pillarbox black
 * bars inside the host element.
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

  const hasNatural = [naturalWidth, naturalHeight].every(isPositiveFinite);
  const hasDisplay = [displayWidth, displayHeight].every(isPositiveFinite);

  if (!hasNatural && !hasDisplay) {
    return null;
  }

  // Resolve the inner rect's width/height. If we have a display rect, the
  // inner rect lives inside it (object-fit: contain on the host element).
  // Otherwise we work directly inside the container.
  const outerWidth = hasDisplay ? displayWidth : containerWidth;
  const outerHeight = hasDisplay ? displayHeight : containerHeight;

  if (!hasNatural) {
    // Display-only path: nothing to compute a ratio from, so the host rect
    // is the best answer we can give.
    return {
      left: hasDisplay ? 0 : 0,
      top: hasDisplay ? 0 : 0,
      width: Math.min(outerWidth, containerWidth),
      height: Math.min(outerHeight, containerHeight),
    };
  }

  const outerRatio = outerWidth / outerHeight;
  const imageRatio = naturalWidth / naturalHeight;

  let innerWidth;
  let innerHeight;
  if (imageRatio > outerRatio) {
    // intrinsic is wider than the host box → pillarbox (bars on top/bottom).
    innerWidth = outerWidth;
    innerHeight = outerWidth / imageRatio;
  } else {
    // intrinsic is taller than the host box → letterbox (bars on left/right).
    innerHeight = outerHeight;
    innerWidth = outerHeight * imageRatio;
  }

  // The inner rect is centered inside the outer (host element or container).
  const offsetX = (outerWidth - innerWidth) / 2;
  const offsetY = (outerHeight - innerHeight) / 2;

  // Frame coordinates: when a display rect is supplied, its top-left is the
  // origin in frame space, so add the offset inside the host. Otherwise the
  // outer IS the frame, so the offset is already the frame-space offset.
  return {
    left: offsetX,
    top: offsetY,
    width: innerWidth,
    height: innerHeight,
  };
}
