import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  marketplaceColors,
  marketplaceShadows,
} from '../../../src/components/marketplace/marketplace-theme';

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
        tabBarIcon: ({ color, size }) =>
          route.name === 'sell' ? (
            <View style={styles.sellIcon}>
              <MaterialIcons color={marketplaceColors.white} name="add" size={27} />
            </View>
          ) : (
            <MaterialIcons
              color={color}
              name={icons[route.name as keyof typeof icons] ?? 'circle'}
              size={size}
            />
          ),
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabel: ({ children, color }) => <TabLabel color={color}>{children}</TabLabel>,
        tabBarStyle: {
          ...marketplaceShadows.floating,
          backgroundColor: marketplaceColors.paper,
          borderTopColor: 'rgba(227,221,210,0.75)',
          height: 74,
          paddingBottom: 9,
          paddingTop: 7,
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
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'center',
  },
  sellIcon: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderColor: marketplaceColors.paper,
    borderRadius: 24,
    borderWidth: 4,
    height: 48,
    justifyContent: 'center',
    marginTop: -14,
    width: 48,
  },
});
