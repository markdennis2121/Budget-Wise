import { Dimensions, PixelRatio, Platform } from 'react-native';

// Guideline sizes are based on standard mobile device (iPhone X/11/12/13/14/15)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Get live screen dimensions — always current, never stale.
 */
function getScreen() {
  return Dimensions.get('window');
}

/**
 * Scales size based on screen width. Always uses live dimensions.
 * Adjusted to handle capped width on Tablets and Desktop.
 */
export const scale = (size) => {
  const { width } = getScreen();
  const isLargeScreen = width > 600;
  const isWebDesktop = Platform.OS === 'web' && width > 1024;

  // If we are on Desktop Web with a sidebar, we use a fixed comfortable scaling.
  if (isWebDesktop) {
    return size * 1.1;
  }

  // If we are on a Tablet (native or web), we are centered in a 480px box.
  if (isLargeScreen) {
    return (480 / guidelineBaseWidth) * size;
  }

  // Standard mobile scaling
  return (width / guidelineBaseWidth) * size;
};

/**
 * Scales size based on screen height. Always uses live dimensions.
 */
export const verticalScale = (size) => {
  const { height } = getScreen();
  return (height / guidelineBaseHeight) * size;
};

/**
 * Moderate scale — good for paddings, margins, icons.
 */
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Normalizes font sizes based on screen width with per-platform rounding.
 */
export const normalize = (size) => {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
};

/**
 * Device size helpers — useful for layout branching on very small or large phones.
 */
export const isSmallDevice = () => getScreen().width < 360;
export const isLargeDevice = () => getScreen().width >= 428;

/**
 * Static exports for backwards compatibility and use outside components.
 */
export const SCREEN_WIDTH = getScreen().width;
export const SCREEN_HEIGHT = getScreen().height;

