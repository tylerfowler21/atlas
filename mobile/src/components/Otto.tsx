import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, View } from "react-native";

/// Otto, drawn.
///
/// He is pixel art, which means his only crisp size is the one he was written
/// at. React Native smooths whatever it resizes, so asking for him at 100
/// points when the asset is 96 does not make him bigger, it makes him blurry —
/// and a blurry pixel is a contradiction. Each pose therefore renders at its
/// own natural size and takes no size prop. To have him larger, redraw the
/// asset larger; `scripts/pixelate-otto.py` takes the grid as an argument.
///
/// Three families, and two of them must not meet. A whole figure and a head
/// and shoulders are framed differently, so putting one where the other was
/// makes him change size when he changes mood. Pick a family per place on
/// screen and stay in it.

const FIGURE = { width: 80, height: 96 };
const FACE = { width: 64, height: 64 };
const TAB = { width: 32, height: 32 };

/// Static requires, because Metro resolves them at build time — a path built
/// from a variable finds nothing.
const POSES = {
  idle: { src: require("../../assets/images/otto/otto-idle.png"), size: FIGURE },
  walking: { src: require("../../assets/images/otto/otto-walking.png"), size: FIGURE },
  searching: { src: require("../../assets/images/otto/otto-searching.png"), size: FIGURE },
  planning: { src: require("../../assets/images/otto/otto-planning.png"), size: FIGURE },
  typing: { src: require("../../assets/images/otto/otto-typing.png"), size: FIGURE },
  pointing: { src: require("../../assets/images/otto/otto-pointing.png"), size: FIGURE },
  found: { src: require("../../assets/images/otto/otto-found.png"), size: FIGURE },
  sleeping: { src: require("../../assets/images/otto/otto-sleeping.png"), size: FIGURE },

  curious: { src: require("../../assets/images/otto/otto-bust-curious.png"), size: FIGURE },
  focused: { src: require("../../assets/images/otto/otto-bust-focused.png"), size: FIGURE },
  happy: { src: require("../../assets/images/otto/otto-bust-happy.png"), size: FIGURE },
  surprised: { src: require("../../assets/images/otto/otto-bust-surprised.png"), size: FIGURE },
  thinking: { src: require("../../assets/images/otto/otto-bust-thinking.png"), size: FIGURE },
  celebrating: { src: require("../../assets/images/otto/otto-bust-celebrating.png"), size: FIGURE },

  avatar: { src: require("../../assets/images/otto/otto-avatar.png"), size: FACE },
  avatarAlt: { src: require("../../assets/images/otto/otto-avatar-alt.png"), size: FACE },
  waving: { src: require("../../assets/images/otto/otto-avatar-waving.png"), size: FACE },
  tab: { src: require("../../assets/images/otto/otto-avatar-small.png"), size: TAB },
} as const;

export type OttoPose = keyof typeof POSES;

/// What he is doing, said in the words the rest of the app uses, so callers do
/// not have to know which drawing stands for which state. Searching is his
/// thinking pose: the hand-on-chin one is a head and shoulders, and mixing it
/// with the standing poses would have him change size mid-thought.
export const OTTO_FOR = {
  resting: "idle",
  thinking: "searching",
  found: "found",
  /// Nothing yet stands for having looked and found nothing. Curious is the
  /// nearest thing that is not celebrating, and it is a stand-in — the pose
  /// that admits a limit is the one still to be drawn.
  empty: "curious",
} as const satisfies Record<string, OttoPose>;

/// Whether the phone has been told to calm down.
function useStillness() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setStill(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return still;
}

export default function Otto({
  pose = "idle",
  /// Whether he breathes. On by default for the standing poses; turn it off
  /// where he sits inside a row and a moving avatar would be a distraction.
  alive = true,
}: {
  pose?: OttoPose;
  alive?: boolean;
}) {
  const still = useStillness();
  const { src, size } = POSES[pose];
  // Held in state rather than a ref: the value is created once either way,
  // and reading a ref during render is the thing the compiler objects to.
  const [float] = useState(() => new Animated.Value(0));
  const moving = alive && !still;

  useEffect(() => {
    if (!moving) {
      float.setValue(0);
      return;
    }
    // Two pixels, slowly. Enough that he is not a sticker, little enough that
    // nobody watches it — presence comes from the timing, not the distance.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, float, pose]);

  return (
    <Animated.View
      style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}
      // He is decoration beside text that already says what is happening.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Rendered at its own size, never scaled — see the note at the top. */}
      <Image source={src} style={size} resizeMode="contain" />
    </Animated.View>
  );
}

/// Otto small enough for a tab bar or a row, with no breathing.
export function OttoMark() {
  return <View style={TAB}><Otto pose="tab" alive={false} /></View>;
}
