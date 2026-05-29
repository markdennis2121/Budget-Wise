import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard mobile device (iPhone X/11/12/13/14/15)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales size based on screen width
 */
export const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales size based on screen height
 */
export const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Moderate scale that doesn't scale as aggressively as 'scale'
 * Good for paddings, margins, and icons
 */
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Normalizes font sizes based on screen width
 */
export const normalize = (size) => {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    // Android fonts often appear slightly larger, subtract a tiny amount for consistency
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  }
};

export { SCREEN_WIDTH, SCREEN_HEIGHT };
