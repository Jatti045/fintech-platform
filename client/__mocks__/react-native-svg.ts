/**
 * Manual mock for react-native-svg used by Jest.
 *
 * The real package imports `Touchable` internals from react-native that are
 * not available in the Jest environment. Components that only render SVG
 * artwork (logos, icons) can safely mount these no-op stubs.
 */

const noop = (_props: Record<string, unknown>) => null;

export const Svg = noop;
export const Path = noop;
export const Circle = noop;
export const Rect = noop;
export const G = noop;
export const Line = noop;
export const Polyline = noop;
export const Polygon = noop;
export const Ellipse = noop;
export const Text = noop;
export const TSpan = noop;
export const Defs = noop;
export const LinearGradient = noop;
export const RadialGradient = noop;
export const Stop = noop;
export const ClipPath = noop;
export const Mask = noop;
export const Use = noop;
export const Symbol = noop;
export const Pattern = noop;
export const Image = noop;
export const ForeignObject = noop;
export const Marker = noop;

export default Svg;
