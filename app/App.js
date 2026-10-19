import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet,
  Alert, Platform, KeyboardAvoidingView, Animated, Easing,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Unbounded_800ExtraBold, Unbounded_900Black } from '@expo-google-fonts/unbounded';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import MoodBackground from './MoodBackground';
import { TONES } from './tones';
import {
  API_URL, REVENUECAT_IOS_KEY, REVENUECAT_ANDROID_KEY, PRO_ENTITLEMENT,
} from './config';

SplashScreen.preventAutoHideAsync().catch(() => {});

const MAX_CHARS = 1000;
const INK = '#0b0b12';
const TEXT = '#f6f4ff';
const MUTED = 'rgba(246,244,255,0.62)';
const GLASS = 'rgba(255,255,255,0.07)';
const EDGE = 'rgba(255,255,255,0.14)';
const F = {
  display: 'Unbounded_800ExtraBold',
  black: 'Unbounded_900Black',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

function hasPro(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT];
}

// Pair tones into columns of two for the swipeable two-row strip.
const COLUMNS = TONES.reduce((cols, t, i) => {
  if (i % 2 === 0) cols.push([t]); else cols[cols.length - 1].push(t);
  return cols;
}, []);

export default function App() {
  const [fontsLoaded] = useFonts({
    Unbounded_800ExtraBold, Unbounded_900Black, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
  });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [message, setMessage] = useState('');
  const [original, setOriginal] = useState('');
  const [result, setResult] = useState('');
  const [active, setActive] = useState(TONES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [userId, setUserId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const threadRef = useRef(null);
  const pop = useRef(new Animated.Value(1)).current;

  // --- Purchases setup -------------------------------------------------
  useEffect(() => {
    try {
      Purchases.configure({
        apiKey: Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY,
      });
      Purchases.getAppUserID().then(setUserId).catch(() => {});
      Purchases.getCustomerInfo().then((info) => setIsPro(hasPro(info))).catch(() => {});
      const listener = (info) => setIsPro(hasPro(info));
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => Purchases.removeCustomerInfoUpdateListener(listener);
    } catch (e) {
      console.warn('RevenueCat not configured:', e?.message);
    }
  }, []);

  const openPaywall = useCallback(async () => {
    try {
      const outcome = await RevenueCatUI.presentPaywall();
      if (outcome === PAYWALL_RESULT.PURCHASED || outcome === PAYWALL_RESULT.RESTORED) {
        const info = await Purchases.getCustomerInfo();
        setIsPro(hasPro(info));
        return hasPro(info);
      }
    } catch (e) {
      Alert.alert('Store unavailable', 'Purchases aren\'t set up on this build yet.');
    }
    return false;
  }, []);

  // Restore lives on the paywall screen (RevenueCat paywalls include a Restore button).

  // --- Rewrite ---------------------------------------------------------
  const rewrite = useCallback(async (tone) => {
    if (loading) return;
    if (!message.trim()) { setError('Type a message first.'); return; }
    if (!tone.free && !isPro) {
      const unlocked = await openPaywall();
      if (!unlocked) return;
    }

    Haptics.selectionAsync().catch(() => {});
    setActive(tone);
    setOriginal(message.trim());
    setLoading(true);
    setResult('');
    setError('');
    setCopied(false);
    setConfirming(false);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), tone: tone.id, userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) { await openPaywall(); return; }
      if (!res.ok) throw new Error(data?.error || 'Something went wrong');
      setResult(data.text);
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    } catch (e) {
      setError(e.message || 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [message, isPro, userId, openPaywall, loading, pop]);

  // --- Copy ------------------------------------------------------------
  const doCopy = useCallback(async () => {
    await Clipboard.setStringAsync(result);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setConfirming(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [result]);

  const onCopy = useCallback(() => {
    if (active.confirm) setConfirming(true); else doCopy();
  }, [active, doCopy]);

  const scrollToEnd = () => threadRef.current?.scrollToEnd({ animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: '#07070c' }}>
      <MoodBackground a={active.a} b={active.b} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.app}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* header */}
          <View style={styles.header}>
            <Text style={styles.logo}>SAY<Text style={{ color: active.a }}>TWICE</Text></Text>
            {isPro ? (
              <View style={[styles.pill, styles.pillPro]}><Text style={styles.pillProText}>Pro ✓</Text></View>
            ) : (
              <TouchableOpacity onPress={openPaywall} style={styles.pill}>
                <Text style={styles.pillText}>Unlock all</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>
            Say it <Text style={{ color: active.a }}>{active.word}</Text>.
          </Text>

          {/* conversation */}
          <ScrollView
            ref={threadRef}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!original && !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Type what you want to say,</Text>
                <Text style={styles.emptyTitle}>then tap a tone.</Text>
                <Text style={styles.emptySub}>Your rewrite shows up here, ready to copy.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.chip}>{active.emoji}  {active.label.toUpperCase()}</Text>
                <View style={styles.origBubble}>
                  <Text style={styles.origText}>{original}</Text>
                </View>
                {loading ? (
                  <LinearGradient colors={[active.a, active.b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.typing}>
                    <TypingDots />
                  </LinearGradient>
                ) : result ? (
                  <>
                    <Animated.View style={{ alignSelf: 'flex-end', maxWidth: '86%', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }], opacity: pop }}>
                      <LinearGradient colors={[active.a, active.b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.outBubble}>
                        <Text style={styles.outText} selectable>{result}</Text>
                      </LinearGradient>
                    </Animated.View>
                    <View style={styles.actions}>
                      <Text style={styles.status}>Ready to send</Text>
                      <TouchableOpacity onPress={onCopy} style={[styles.copy, copied && styles.copyDone]}>
                        <Text style={styles.copyText}>{copied ? 'COPIED ✓' : 'COPY'}</Text>
                      </TouchableOpacity>
                    </View>
                    {confirming && (
                      <View style={styles.confirm}>
                        <Text style={styles.confirmText}><Text style={{ fontFamily: F.bold }}>You sure? 🔥</Text> This one might start a fire.</Text>
                        <View style={styles.confirmRow}>
                          <TouchableOpacity style={styles.confirmBtn} onPress={() => setConfirming(false)}>
                            <Text style={styles.confirmBtnText}>Cool off</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.confirmBtn, styles.danger]} onPress={doCopy}>
                            <Text style={[styles.confirmBtnText, { color: INK }]}>Copy it</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                ) : null}
              </>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          {/* tone strip */}
          <View style={styles.stripHead}>
            <Text style={styles.stripLabel}>TAP A TONE</Text>
            <Text style={styles.stripLabel}>SWIPE →</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.strip}
            contentContainerStyle={styles.stripContent}
            keyboardShouldPersistTaps="always"
          >
            {COLUMNS.map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map((t) => (
                  <ToneTile key={t.id} tone={t} active={t.id === active.id}
                    locked={!t.free && !isPro} showFree={t.free && !isPro}
                    disabled={loading} onPress={() => rewrite(t)} />
                ))}
              </View>
            ))}
          </ScrollView>

          {/* composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Type it how you feel it…"
              placeholderTextColor={MUTED}
              value={message}
              onChangeText={(t) => { setMessage(t.slice(0, MAX_CHARS)); if (error) setError(''); }}
              selectionColor={active.a}
            />
            {!!message && (
              <Pressable onPress={() => setMessage('')} style={styles.clear} hitSlop={8}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ToneTile({ tone, active, locked, showFree, disabled, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.timing(scale, { toValue: 0.94, duration: 90, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  const inner = (
    <>
      <Text style={[styles.tileEmoji, locked && { opacity: 0.5 }]}>{tone.emoji}</Text>
      <Text style={[styles.tileName, active && { color: INK }, locked && { color: MUTED }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{tone.label}</Text>
      {showFree && <View style={[styles.tag, styles.tagFree]}><Text style={styles.tagFreeText}>FREE</Text></View>}
      {locked && <View style={[styles.tag, styles.tagLock]}><Text style={styles.tagLockText}>PRO</Text></View>}
    </>
  );
  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {active ? (
          <LinearGradient colors={[tone.a, tone.b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, styles.tileActive]}>
            {inner}
          </LinearGradient>
        ) : (
          <View style={styles.tile}>{inner}</View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(300 - i * 150),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.dot, {
          opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
          transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
        }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontFamily: F.black, fontSize: 22, color: TEXT, letterSpacing: -0.8 },
  pill: { backgroundColor: TEXT, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  pillText: { fontFamily: F.bold, fontSize: 13, color: INK },
  pillPro: { backgroundColor: GLASS, borderWidth: 1, borderColor: EDGE },
  pillProText: { fontFamily: F.bold, fontSize: 13, color: TEXT },
  hero: { fontFamily: F.display, fontSize: 30, color: TEXT, letterSpacing: -1 },

  thread: { flex: 1 },
  threadContent: { flexGrow: 1, justifyContent: 'flex-end', gap: 8, paddingVertical: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyTitle: { fontFamily: F.medium, fontSize: 17, color: TEXT, textAlign: 'center' },
  emptySub: { fontFamily: F.body, fontSize: 14, color: MUTED, textAlign: 'center', marginTop: 8 },
  chip: { alignSelf: 'center', fontFamily: F.bold, fontSize: 11, letterSpacing: 1.5, color: MUTED },
  origBubble: {
    alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
  },
  origText: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: MUTED, textDecorationLine: 'line-through' },
  outBubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
  },
  outText: { fontFamily: F.medium, fontSize: 16, lineHeight: 22, color: INK },
  typing: { alignSelf: 'flex-end', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: INK },
  actions: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { fontFamily: F.body, fontSize: 11, color: MUTED },
  copy: { backgroundColor: TEXT, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  copyDone: { backgroundColor: '#7df0a4' },
  copyText: { fontFamily: F.display, fontSize: 12, letterSpacing: 0.6, color: INK },
  confirm: { backgroundColor: 'rgba(255,80,40,0.14)', borderWidth: 1, borderColor: 'rgba(255,110,70,0.6)', borderRadius: 18, padding: 12, gap: 10 },
  confirmText: { fontFamily: F.body, fontSize: 14, color: TEXT },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: EDGE, backgroundColor: GLASS },
  confirmBtnText: { fontFamily: F.bold, fontSize: 14, color: TEXT },
  danger: { backgroundColor: '#ff5a36', borderColor: '#ff5a36' },
  error: { alignSelf: 'center', textAlign: 'center', fontFamily: F.body, fontSize: 13, color: '#ffb4a3' },

  stripHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: -4 },
  stripLabel: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: MUTED },
  strip: { flexGrow: 0, marginHorizontal: -16 },
  stripContent: { paddingHorizontal: 16, gap: 8 },
  col: { gap: 8 },
  tile: {
    width: 120, height: 58, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8,
    justifyContent: 'space-between', backgroundColor: GLASS, borderWidth: 1, borderColor: EDGE,
  },
  tileActive: { borderColor: 'transparent' },
  tileEmoji: { fontSize: 20, lineHeight: 24 },
  tileName: { fontFamily: F.bold, fontSize: 12.5, color: TEXT },
  tag: { position: 'absolute', top: 7, right: 7, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  tagFree: { backgroundColor: TEXT },
  tagFreeText: { fontFamily: F.bold, fontSize: 8, letterSpacing: 0.8, color: INK },
  tagLock: { backgroundColor: 'rgba(0,0,0,0.35)' },
  tagLockText: { fontFamily: F.bold, fontSize: 8, letterSpacing: 0.8, color: MUTED },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: GLASS, borderWidth: 1, borderColor: EDGE, borderRadius: 24,
    paddingLeft: 16, paddingRight: 8, paddingVertical: 8,
  },
  input: { flex: 1, maxHeight: 96, minHeight: 34, fontFamily: F.body, fontSize: 16, color: TEXT, paddingTop: 7, paddingBottom: 7 },
  clear: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  clearText: { color: MUTED, fontSize: 15 },
});
