import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import Purchases from 'react-native-purchases';
import * as Haptics from 'expo-haptics';
import { CREDITS_OFFERING } from './config';

const INK = '#0b0b12';
const TEXT = '#f6f4ff';
const MUTED = 'rgba(246,244,255,0.62)';
const GLASS = 'rgba(255,255,255,0.07)';
const EDGE = 'rgba(255,255,255,0.14)';

// "saytwice_credits_150" -> 150. Same ids as backend/netlify/functions/limits.js.
const amountOf = (pkg) => Number(pkg.product.identifier.match(/credits_(\d+)/)?.[1] || 0);

// Bottom sheet where anyone can buy rewrite credit packs. Prices come from the
// App Store / Google Play, so they show in the buyer's own currency.
export default function Store({ visible, onClose, isPro, left, accent, onBought, onGoPro }) {
  const [packs, setPacks] = useState(null);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    if (!visible || packs) return;
    Purchases.getOfferings()
      .then((o) => setPacks((o.all[CREDITS_OFFERING]?.availablePackages || [])
        .filter(amountOf).sort((a, b) => amountOf(a) - amountOf(b))))
      .catch(() => setPacks([]));
  }, [visible, packs]);

  const buy = async (pkg) => {
    setBuying(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onBought();
      onClose();
    } catch (e) {
      if (!e?.userCancelled) Alert.alert('Purchase didn\'t go through', e?.message || 'Try again in a moment.');
    } finally {
      setBuying(null);
    }
  };

  const biggest = packs?.length ? amountOf(packs[packs.length - 1]) : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Get more rewrites</Text>
        <Text style={styles.sub}>
          {left ? `${left.today} left today${left.credits ? ` + ${left.credits} credits` : ''}. ` : ''}
          Credits never expire and kick in after your daily {isPro ? '50' : '5'}.
        </Text>

        {packs === null ? (
          <ActivityIndicator color={TEXT} style={{ marginVertical: 30 }} />
        ) : packs.length === 0 ? (
          <Text style={[styles.sub, { marginVertical: 20 }]}>The store isn't set up on this build yet.</Text>
        ) : (
          <View style={styles.packs}>
            {packs.map((pkg) => {
              const n = amountOf(pkg);
              return (
                <TouchableOpacity key={pkg.identifier} style={[styles.pack, n === biggest && { borderColor: accent }]}
                  onPress={() => buy(pkg)} disabled={!!buying}>
                  {n === biggest && <Text style={[styles.best, { backgroundColor: accent }]}>BEST VALUE</Text>}
                  <Text style={styles.amount}>+{n}</Text>
                  <Text style={styles.unit}>rewrites</Text>
                  <View style={styles.price}>
                    {buying === pkg.identifier
                      ? <ActivityIndicator color={INK} size="small" />
                      : <Text style={styles.priceText}>{pkg.product.priceString}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!isPro && (
          <TouchableOpacity style={styles.pro} onPress={() => { onClose(); onGoPro(); }}>
            <Text style={styles.proText}>Or go Pro: every tone, 50 a day</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#14141d', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: EDGE, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: EDGE, marginBottom: 6 },
  title: { fontFamily: 'Unbounded_800ExtraBold', fontSize: 22, color: TEXT, letterSpacing: -0.6 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: MUTED },
  packs: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pack: {
    flex: 1, alignItems: 'center', backgroundColor: GLASS, borderWidth: 1, borderColor: EDGE,
    borderRadius: 18, paddingTop: 20, paddingBottom: 12, paddingHorizontal: 8,
  },
  best: {
    position: 'absolute', top: -9, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden',
    fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 0.8, color: INK,
  },
  amount: { fontFamily: 'Unbounded_900Black', fontSize: 24, color: TEXT, letterSpacing: -0.8 },
  unit: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: MUTED, marginBottom: 12 },
  price: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: TEXT, borderRadius: 999, paddingVertical: 8, minHeight: 34, justifyContent: 'center' },
  priceText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: INK },
  pro: { alignItems: 'center', paddingVertical: 10 },
  proText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: TEXT, textDecorationLine: 'underline' },
});
