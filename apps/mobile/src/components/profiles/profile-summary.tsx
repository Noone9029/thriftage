import type { PrivateUserProfile, PublicUserProfile } from '@thriftage/shared';
import { Image, StyleSheet, Text, View } from 'react-native';

interface ProfileSummaryProps {
  readonly profile: PrivateUserProfile | PublicUserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  return (
    <View style={styles.container}>
      {profile.profileImageUrl === null ? (
        <View accessibilityLabel="No profile picture" style={styles.placeholder}>
          <Text style={styles.initial}>@</Text>
        </View>
      ) : (
        <Image
          accessibilityLabel={`${profile.username}'s profile picture`}
          source={{ uri: profile.profileImageUrl }}
          style={styles.image}
        />
      )}
      <View style={styles.details}>
        <Text accessibilityRole="header" style={styles.username}>
          @{profile.username}
        </Text>
        {profile.bio === null ? null : <Text style={styles.bio}>{profile.bio}</Text>}
        {profile.university === null ? null : <Text style={styles.meta}>{profile.university}</Text>}
        <Text style={styles.meta}>
          Member since {new Date(profile.memberSince).toLocaleDateString()}
        </Text>
        <Text style={styles.metric}>{profile.completedSalesCount} completed sales</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bio: { color: '#3D4944', fontSize: 16, lineHeight: 24 },
  container: { alignItems: 'center', gap: 20 },
  details: { alignItems: 'center', gap: 8, maxWidth: 520 },
  image: { borderRadius: 64, height: 128, width: 128 },
  initial: { color: '#17664F', fontSize: 44, fontWeight: '800' },
  meta: { color: '#6B6B65', fontSize: 14 },
  metric: { color: '#17664F', fontSize: 14, fontWeight: '700' },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#E4DED1',
    borderRadius: 64,
    height: 128,
    justifyContent: 'center',
    width: 128,
  },
  username: { color: '#1D2924', fontSize: 30, fontWeight: '700' },
});
