import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

export default function PersonalizationSettingsScreen() {
  const queryClient = useQueryClient();
  const privacy = useQuery({
    queryFn: () => thriftageApiClient.getPersonalizationPrivacy(),
    queryKey: ['personalization', 'privacy'],
  });
  const learnedReset = useMutation({
    mutationFn: () => thriftageApiClient.resetLearnedSignals(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['personalization'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace', 'feed', 'RECOMMENDED'] });
    },
  });
  const profileReset = useMutation({
    mutationFn: () => thriftageApiClient.resetStyleProfile(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['personalization'] });
      router.replace('/style-profile');
    },
  });
  if (privacy.isLoading)
    return (
      <MarketplaceState
        loading
        message="Loading your personalization controls."
        title="Opening privacy settings"
      />
    );
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <MaterialIcons color={marketplaceColors.text} name="arrow-back" size={25} />
        </Pressable>
        <Text style={styles.headerTitle}>Personalization & privacy</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>You control what discovery learns.</Text>
        <Text style={styles.body}>
          Your style profile is private. Ranking uses your declared preferences, authoritative
          marketplace actions, and recent privacy-safe interaction events. It never exposes your
          profile to sellers or other users.
        </Text>
        <View style={styles.card}>
          <Setting
            icon="style"
            title="Edit style profile"
            detail={
              privacy.data?.profileCompleted
                ? 'Completed — edit or retake anytime.'
                : 'Not completed yet.'
            }
            onPress={() => router.push('/style-profile')}
          />
          <Setting
            icon="history"
            title="Reset learned signals"
            detail={
              privacy.data?.hasLearnedSignals
                ? 'Recent activity currently influences ranking.'
                : 'No activity currently influences ranking.'
            }
            onPress={() =>
              Alert.alert(
                'Reset learned signals?',
                'Likes, saves, follows, messages, and orders stay intact. Only their use for future ranking is reset.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => learnedReset.mutate() },
                ],
              )
            }
          />
          <Setting
            icon="restart-alt"
            title="Reset style profile"
            detail="Clears quiz answers and starts again. Marketplace activity remains intact."
            onPress={() =>
              Alert.alert('Reset style profile?', 'Your structured quiz answers will be removed.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset profile',
                  style: 'destructive',
                  onPress: () => profileReset.mutate(),
                },
              ])
            }
          />
        </View>
        <Text style={styles.note}>
          Resetting learned signals creates a timestamp boundary. Existing likes, saves, follows,
          messages, and orders remain authoritative product records but older activity is ignored by
          the ranking engine.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Setting({
  detail,
  icon,
  onPress,
  title,
}: {
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.setting}>
      <View style={styles.icon}>
        <MaterialIcons color={marketplaceColors.forest} name={icon} size={22} />
      </View>
      <View style={styles.settingBody}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <MaterialIcons color={marketplaceColors.muted} name="chevron-right" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { color: marketplaceColors.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  card: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 28,
    overflow: 'hidden',
  },
  content: { padding: 22 },
  header: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 18,
  },
  headerTitle: { color: marketplaceColors.text, fontSize: 16, fontWeight: '900' },
  icon: {
    alignItems: 'center',
    backgroundColor: '#E1E7E1',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  note: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 19, marginTop: 24 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  setting: {
    alignItems: 'center',
    borderBottomColor: marketplaceColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  settingBody: { flex: 1 },
  settingDetail: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  settingTitle: { color: marketplaceColors.text, fontSize: 14, fontWeight: '900' },
  spacer: { width: 25 },
  title: {
    color: marketplaceColors.forest,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 35,
  },
});
