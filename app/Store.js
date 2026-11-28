import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, StyleSheet, Linking } from 'react-native';
import Purchases from 'react-native-purchases';
import * as Haptics from 'expo-haptics';
import { CREDITS_OFFERING, PRIVACY_URL, TERMS_URL, PRO_ENTITLEMENT } from './config';
import { offeringsWithRetry, withTimeout, MANAGE_SUBSCRIPTION_URL } from './rc';
import { adPrivacyOptionsRequired, showAdPrivacyOptions } from './ads';

const INK = '#0b0b12';
const TEXT = '#f6f4ff';
const MUTED = 'rgba(246,244,255,0.62)';
const GLASS = 'rgba(255,255,255,0.07)';
const EDGE = 'rgba(255,255,255,0.14)';

// "saytwice_credits_200" -> 200. Same ids as backend/netlify/functions/limits.js.
const amountOf = (pkg) => Number(pkg.product.identifier.match(/credits_(\d+)/)?.[1] || 0);

// Bottom sheet where anyone can buy rewrite credit packs. Prices come from the
// App Store / Google Play, so they show in the buyer's own currency.
export default function Store({ visible, onClose, isPro, left, accent, onBought, onGoPro }) {
  const [packs, setPacks] = useState(null);
  const [buying, setBuying] = useState(null);
  const [adChoices, setAdChoices] = useState(false); // Europe etc.: a way to change ad consent later

  useEffect(() => {
    if (visible && !isPro) adPrivacyOptionsRequired().then(setAdChoices);
  }, [visible, isPro]);

  const [restoring, setRestoring] = useState(false);

  // Prices come from the store (never typed in here). Retries for ~30s, then offers Try again.
  const loadPacks = () => {
    setPacks(null);
    offeringsWithRetry((o) => {
      const list = (o?.all?.[CREDITS_OFFERING]?.availablePackages || []).filter(amountOf);
      return list.length ? list.sort((a, b) => amountOf(a) - amountOf(b)) : null;
    }).then((list) => setPacks(list || []));
  };
  useEffect(() => { if (visible && !packs) loadPacks(); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async () => {
    setRestoring(true);
    try {
      const info = await withTimeout(Purchases.restorePurchases(), 30000, 'Restore');
      await onBought();
      Alert.alert('Restored', info?.entitlements?.active?.[PRO_ENTITLEMENT] ? 'Pro is back on.' : 'Nothing to restore on this account.');
    } catch (e) {
      Alert.alert('Restore didn\'t work', e?.message || 'Try again in a moment.');
    } finally {
      setRestoring(false);
    }
  };

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
          <View style={{ alignItems: 'center', marginVertical: 14, gap: 10 }}>
            <Text style={styles.sub}>Couldn't reach the store. Check your connection.</Text>
            <TouchableOpacity style={styles.retry} onPress={loadPacks}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.packs}>
            {packs.map((pkg) => {
              const n = amountOf(pkg);
              return (
                <TouchableOpacity key={pkg.identifier} style={[styles.pack, n === biggest && { borderColor: accent }]}
                  onPress={() => buy(pkg)} disabled={!!buying}>
                  {n === biggest && <Text style={[styles.best, { backgroundColor: accent }]}>BEST VALUE</Text>}
                  <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>+{n}</Text>
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
            <Text style={styles.proText}>Or go Pro: every tone, 50 a day, no ads</Text>
          </TouchableOpacity>
        )}
        <View style={styles.links}>
          <Text style={styles.link} onPress={restore}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
          {isPro && <Text style={styles.link} onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}>Manage subscription</Text>}
          <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy</Text>
        </View>
        {!isPro && adChoices && (
          <TouchableOpacity style={styles.adChoices} onPress={showAdPrivacyOptions}>
            <Text style={styles.adChoicesText}>Ad privacy choices</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  // Full width on phones; on tablets it stays phone-sized and centred instead of stretching.
  sheet: {
    width: '100%', maxWidth: 560, alignSelf: 'center',
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
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 6 },
  link: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: MUTED, textDecorationLine: 'underline' },
  retry: { backgroundColor: TEXT, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: INK },
  adChoices: { alignItems: 'center', marginTop: -8 },
  adChoicesText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MUTED },
  proText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: TEXT, textDecorationLine: 'underline' },
});
