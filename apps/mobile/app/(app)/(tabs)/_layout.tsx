import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';

const icons = {
  index: 'home',
  profile: 'person',
  saved: 'bookmark',
  search: 'search',
  sell: 'add-circle',
} as const;

export default function MarketplaceTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: marketplaceColors.forest,
        tabBarInactiveTintColor: '#777C77',
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons
            color={color}
            name={icons[route.name as keyof typeof icons] ?? 'circle'}
            size={size}
          />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: marketplaceColors.paper,
          borderTopColor: marketplaceColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="sell" options={{ title: 'Sell' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
