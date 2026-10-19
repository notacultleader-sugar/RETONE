// The glowing "mood light" behind the whole screen.
// Three soft colour blobs drift slowly; when the tone changes, the new colours fade in over the old.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

function Blob({ color, size, style, duration, dx, dy, id }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  const transform = [
    { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
  ];
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size }, style, { transform }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.85" />
            <Stop offset="0.45" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Layer({ a, b, opacity, layerKey }) {
  const { width, height } = useWindowDimensions();
  const big = Math.max(width, height);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Blob id={`a1${layerKey}`} color={a} size={big * 0.95} duration={8000} dx={30} dy={24}
        style={{ left: -big * 0.35, top: -big * 0.35 }} />
      <Blob id={`b1${layerKey}`} color={b} size={big * 0.85} duration={9500} dx={-36} dy={-30}
        style={{ right: -big * 0.4, top: height * 0.3 }} />
      <Blob id={`a2${layerKey}`} color={a} size={big * 0.6} duration={11500} dx={24} dy={-18}
        style={{ left: width * 0.05, bottom: -big * 0.3, opacity: 0.6 }} />
    </Animated.View>
  );
}

export default function MoodBackground({ a, b }) {
  // Keep the previous colours underneath while the new ones fade in.
  const [layers, setLayers] = useState([{ key: 0, a, b }]);
  const fade = useRef(new Animated.Value(1)).current;
  const nextKey = useRef(1);

  useEffect(() => {
    const top = layers[layers.length - 1];
    if (top.a === a && top.b === b) return;
    const key = nextKey.current++;
    setLayers([top, { key, a, b }]);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => setLayers([{ key, a, b }]));
  }, [a, b]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#07070c' }]} pointerEvents="none">
      {layers.map((l, i) => (
        <Layer key={l.key} layerKey={l.key} a={l.a} b={l.b}
          opacity={i === layers.length - 1 && layers.length > 1 ? fade : 1} />
      ))}
      {/* dark veil keeps text readable over the glow */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,7,12,0.28)' }]} />
    </View>
  );
}
