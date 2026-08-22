import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';

const icons = {
  index: 'home',
  profile: 'person',
  saved: 'bookmark',
  search: 'search',
  sell: 'add-circle',
} as const;

// Five compact-width destinations must remain labeled without overlapping at 200% system text.
const tabLabelMaxFontSizeMultiplier = 1.3;

function TabLabel({ children, color }: { readonly children: string; readonly color: ColorValue }) {
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={tabLabelMaxFontSizeMultiplier}
      numberOfLines={1}
      style={[styles.tabLabel, { color }]}
    >
      {children}
    </Text>
  );
}

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
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabel: ({ children, color }) => <TabLabel color={color}>{children}</TabLabel>,
        tabBarStyle: {
          backgroundColor: marketplaceColors.paper,
          borderTopColor: marketplaceColors.border,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarAccessibilityLabel: 'Open Discover tab', title: 'Discover' }}
      />
      <Tabs.Screen
        name="search"
        options={{ tabBarAccessibilityLabel: 'Open Search tab', title: 'Search' }}
      />
      <Tabs.Screen
        name="sell"
        options={{ tabBarAccessibilityLabel: 'Open Sell tab', title: 'Sell' }}
      />
      <Tabs.Screen
        name="saved"
        options={{ tabBarAccessibilityLabel: 'Open Saved tab', title: 'Saved' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarAccessibilityLabel: 'Open Profile tab', title: 'Profile' }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    textAlign: 'center',
  },
});
