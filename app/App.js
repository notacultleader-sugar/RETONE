import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { TONES } from './tones';
import {
  API_URL, REVENUECAT_IOS_KEY, REVENUECAT_ANDROID_KEY, PRO_ENTITLEMENT,
} from './config';

const MAX_CHARS = 1000;

function hasPro(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT];
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [activeTone, setActiveTone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [userId, setUserId] = useState(null);
  const [copied, setCopied] = useState(false);

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
      // Running without RevenueCat set up yet (e.g. in Expo Go). Free tones still work.
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

  const restore = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      const pro = hasPro(info);
      setIsPro(pro);
      Alert.alert(pro ? 'Restored' : 'Nothing to restore',
        pro ? 'All tones unlocked.' : 'No previous purchase found on this account.');
    } catch (e) {
      Alert.alert('Restore failed', 'Please try again.');
    }
  }, []);

  // --- Rewrite ---------------------------------------------------------
  const retone = useCallback(async (tone) => {
    if (!message.trim()) {
      Alert.alert('Type something first', 'Write the message you want to send.');
      return;
    }
    if (!tone.free && !isPro) {
      const unlocked = await openPaywall();
      if (!unlocked) return;
    }

    Haptics.selectionAsync().catch(() => {});
    setActiveTone(tone.id);
    setLoading(true);
    setResult('');
    setCopied(false);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), tone: tone.id, userId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        await openPaywall();
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Something went wrong');
      setResult(data.text);
    } catch (e) {
      Alert.alert('Couldn\'t rewrite that', e.message || 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [message, isPro, userId, openPaywall]);

  // --- Copy ------------------------------------------------------------
  const doCopy = useCallback(async () => {
    await Clipboard.setStringAsync(result);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const copy = useCallback(() => {
    const tone = TONES.find((t) => t.id === activeTone);
    if (tone?.confirm) {
      Alert.alert(
        'You sure? 🔥',
        'This one might start a fire. Still want to copy it?',
        [
          { text: 'Cool off', style: 'cancel' },
          { text: 'Copy it', style: 'destructive', onPress: doCopy },
        ],
      );
    } else {
      doCopy();
    }
  }, [activeTone, doCopy]);

  const activeLabel = TONES.find((t) => t.id === activeTone)?.label;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Retone</Text>
            {!isPro && (
              <TouchableOpacity onPress={openPaywall} style={styles.proPill}>
                <Text style={styles.proPillText}>Unlock all ✨</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>What do you want to say?</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Type your message…"
            placeholderTextColor="#6b6b78"
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, MAX_CHARS))}
          />
          <Text style={styles.counter}>{message.length}/{MAX_CHARS}</Text>

          <Text style={styles.label}>Pick a tone</Text>
          <View style={styles.grid}>
            {TONES.map((tone) => {
              const locked = !tone.free && !isPro;
              const active = activeTone === tone.id;
              return (
                <TouchableOpacity
                  key={tone.id}
                  style={[styles.tone, active && styles.toneActive, locked && styles.toneLocked]}
                  onPress={() => retone(tone)}
                  disabled={loading}
                >
                  <Text style={styles.toneEmoji}>{tone.emoji}</Text>
                  <Text style={[styles.toneText, locked && styles.toneTextLocked]}>
                    {tone.label}
                  </Text>
                  {locked && <Text style={styles.lock}>🔒</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {(loading || result) ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{activeLabel ? `${activeLabel} version` : 'Result'}</Text>
              {loading ? (
                <ActivityIndicator color="#c7f464" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <Text style={styles.resultText} selectable>{result}</Text>
                  <TouchableOpacity style={[styles.copyBtn, copied && styles.copyBtnDone]} onPress={copy}>
                    <Text style={styles.copyText}>{copied ? 'Copied ✓' : 'Copy to clipboard'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          {!isPro && (
            <TouchableOpacity onPress={restore} style={styles.restore}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BG = '#111116';
const CARD = '#1c1c24';
const ACCENT = '#c7f464';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  logo: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  proPill: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  proPillText: { color: BG, fontWeight: '700' },
  label: { color: '#a0a0ad', fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: CARD, color: '#fff', borderRadius: 16, padding: 16,
    fontSize: 17, minHeight: 130, textAlignVertical: 'top',
  },
  counter: { color: '#5c5c68', fontSize: 12, alignSelf: 'flex-end', marginTop: 6, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tone: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 999,
    borderWidth: 1.5, borderColor: CARD,
  },
  toneActive: { borderColor: ACCENT },
  toneLocked: { opacity: 0.55 },
  toneEmoji: { fontSize: 16, marginRight: 6 },
  toneText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toneTextLocked: { color: '#c9c9d3' },
  lock: { fontSize: 11, marginLeft: 6 },
  resultCard: { backgroundColor: CARD, borderRadius: 16, padding: 18 },
  resultLabel: { color: ACCENT, fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  resultText: { color: '#fff', fontSize: 17, lineHeight: 25 },
  copyBtn: { marginTop: 18, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  copyBtnDone: { backgroundColor: '#8fd16a' },
  copyText: { color: BG, fontSize: 16, fontWeight: '800' },
  restore: { alignItems: 'center', marginTop: 28 },
  restoreText: { color: '#5c5c68', fontSize: 13, textDecorationLine: 'underline' },
});
