import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { marketplaceColors, marketplaceRadii, marketplaceSpacing } from './marketplace-theme';

function useSkeletonOpacity() {
  const opacity = useRef(new Animated.Value(0.42)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 700, toValue: 0.82, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 700, toValue: 0.42, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return opacity;
}

export function ListingGridSkeleton() {
  const opacity = useSkeletonOpacity();
  return (
    <View
      accessibilityLabel="Loading fashion pieces"
      accessibilityRole="progressbar"
      style={styles.grid}
    >
      {[0, 1, 2, 3].map((index) => (
        <Animated.View key={index} style={[styles.card, { opacity }]}>
          <View style={styles.image} />
          <View style={styles.lineWide} />
          <View style={styles.lineMedium} />
          <View style={styles.lineShort} />
        </Animated.View>
      ))}
    </View>
  );
}

export function DetailSkeleton() {
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View
      accessibilityLabel="Loading item details"
      accessibilityRole="progressbar"
      style={[styles.detail, { opacity }]}
    >
      <View style={styles.detailImage} />
      <View style={styles.detailBody}>
        <View style={styles.lineShort} />
        <View style={styles.detailTitle} />
        <View style={styles.lineMedium} />
        <View style={styles.detailCard} />
      </View>
    </Animated.View>
  );
}

export function ProfileSkeleton() {
  const opacity = useSkeletonOpacity();
  return (
    <SafeAreaView style={styles.profileSafe}>
      <Animated.View
        accessibilityLabel="Loading profile"
        accessibilityRole="progressbar"
        style={[styles.profile, { opacity }]}
      >
        <View style={styles.profileCover} />
        <View style={styles.profileAvatar} />
        <View style={styles.profileTitle} />
        <View style={styles.profileSubtitle} />
        <View style={styles.profileStats}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.profileStat} />
          ))}
        </View>
        <View style={styles.profileSection} />
        <View style={styles.grid}>
          {[0, 1].map((index) => (
            <View key={index} style={styles.card}>
              <View style={styles.image} />
              <View style={styles.lineWide} />
              <View style={styles.lineMedium} />
            </View>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

export function ListRowsSkeleton({ label = 'Loading items' }: { readonly label?: string }) {
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[styles.rows, { opacity }]}
    >
      <View style={styles.rowsHeader} />
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.row}>
          <View style={styles.rowVisual} />
          <View style={styles.rowCopy}>
            <View style={styles.rowTitle} />
            <View style={styles.rowLine} />
            <View style={styles.rowLineShort} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: marketplaceColors.paper,
    borderRadius: marketplaceRadii.xl,
    gap: marketplaceSpacing.sm,
    overflow: 'hidden',
    paddingBottom: marketplaceSpacing.md,
    width: '48%',
  },
  detail: { backgroundColor: marketplaceColors.background, flex: 1 },
  detailBody: { gap: marketplaceSpacing.md, padding: marketplaceSpacing.xl },
  detailCard: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.lg,
    height: 100,
  },
  detailImage: { backgroundColor: marketplaceColors.sand, height: 430, width: '100%' },
  detailTitle: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 8,
    height: 34,
    width: '84%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: marketplaceSpacing.md,
    paddingHorizontal: marketplaceSpacing.sm,
    paddingVertical: marketplaceSpacing.xl,
  },
  image: { aspectRatio: 0.78, backgroundColor: marketplaceColors.sand, width: '100%' },
  lineMedium: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 11,
    marginHorizontal: 12,
    width: '58%',
  },
  lineShort: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 9,
    marginHorizontal: 12,
    width: '38%',
  },
  lineWide: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 13,
    marginHorizontal: 12,
    width: '76%',
  },
  profile: {
    backgroundColor: marketplaceColors.background,
    flex: 1,
    padding: marketplaceSpacing.lg,
  },
  profileSafe: { backgroundColor: marketplaceColors.background, flex: 1 },
  profileAvatar: {
    alignSelf: 'center',
    backgroundColor: marketplaceColors.sand,
    borderColor: marketplaceColors.background,
    borderRadius: 48,
    borderWidth: 5,
    height: 96,
    marginTop: -48,
    width: 96,
  },
  profileCover: {
    backgroundColor: marketplaceColors.forestSoft,
    borderRadius: marketplaceRadii.hero,
    height: 154,
  },
  profileSection: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 7,
    height: 20,
    marginTop: marketplaceSpacing.xxl,
    width: '46%',
  },
  profileStat: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.sm,
    height: 42,
    width: '21%',
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: marketplaceSpacing.xl,
  },
  profileSubtitle: {
    alignSelf: 'center',
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 10,
    marginTop: marketplaceSpacing.sm,
    width: '28%',
  },
  profileTitle: {
    alignSelf: 'center',
    backgroundColor: marketplaceColors.sand,
    borderRadius: 8,
    height: 24,
    marginTop: marketplaceSpacing.md,
    width: '44%',
  },
  row: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderRadius: marketplaceRadii.xl,
    flexDirection: 'row',
    gap: marketplaceSpacing.md,
    padding: marketplaceSpacing.md,
  },
  rowCopy: { flex: 1, gap: marketplaceSpacing.sm },
  rowLine: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 10,
    width: '72%',
  },
  rowLineShort: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 6,
    height: 9,
    width: '42%',
  },
  rowTitle: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: 7,
    height: 15,
    width: '58%',
  },
  rowVisual: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.lg,
    height: 72,
    width: 60,
  },
  rows: {
    backgroundColor: marketplaceColors.background,
    flex: 1,
    gap: marketplaceSpacing.md,
    padding: marketplaceSpacing.lg,
  },
  rowsHeader: {
    backgroundColor: marketplaceColors.sand,
    borderRadius: marketplaceRadii.lg,
    height: 96,
    marginBottom: marketplaceSpacing.sm,
  },
});
