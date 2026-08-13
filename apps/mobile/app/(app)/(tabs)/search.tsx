import { MaterialIcons } from '@expo/vector-icons';
import type {
  CategoryTreeNode,
  ListingCondition,
  ListingDetail,
  ListingPage,
  ListingSearchQuery,
} from '@thriftage/shared';
import {
  colorFamilyValues,
  fitTypeValues,
  garmentRoleValues,
  type ColorFamily,
  type FitType,
  type GarmentRole,
} from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../../src/components/marketplace/marketplace-theme';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

const conditions: readonly ListingCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];
const sorts: readonly { readonly label: string; readonly value: ListingSearchQuery['sort'] }[] = [
  { label: 'For you', value: 'PERSONALIZED' },
  { label: 'Newest', value: 'NEWEST' },
  { label: 'Price ↑', value: 'PRICE_LOW' },
  { label: 'Price ↓', value: 'PRICE_HIGH' },
  { label: 'Oldest', value: 'OLDEST' },
];

function flattenCategories(nodes: readonly CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

function rupeesToMinor(value: string): number | undefined {
  const parsed = Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : undefined;
}

export default function SearchScreen() {
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [condition, setCondition] = useState<ListingCondition>();
  const [size, setSize] = useState('');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [sort, setSort] = useState<ListingSearchQuery['sort']>('NEWEST');
  const [styleDefinitionId, setStyleDefinitionId] = useState<string>();
  const [colorFamily, setColorFamily] = useState<ColorFamily>();
  const [fitType, setFitType] = useState<FitType>();
  const [garmentRole, setGarmentRole] = useState<GarmentRole>();
  const actions = useListingActions();
  const categories = useQuery({
    queryFn: () => thriftageApiClient.getCategories(),
    queryKey: ['marketplace', 'categories'],
  });
  const styleDefinitions = useQuery({
    queryFn: () => thriftageApiClient.getStyles(),
    queryKey: ['personalization', 'styles'],
    staleTime: 300_000,
  });
  const filters = {
    categoryId,
    condition,
    currency: 'PKR' as const,
    maxPriceMinor: rupeesToMinor(maximum),
    minPriceMinor: rupeesToMinor(minimum),
    q: query || undefined,
    size: size.trim() || undefined,
    sort,
    colorFamily,
    fitType,
    garmentRole,
    styleDefinitionIds: styleDefinitionId === undefined ? undefined : [styleDefinitionId],
  };
  const results = useInfiniteQuery<
    ListingPage,
    Error,
    InfiniteData<ListingPage>,
    readonly unknown[],
    string | null
  >({
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      thriftageApiClient.searchListings({ ...filters, cursor: pageParam ?? undefined }),
    queryKey: ['marketplace', 'search', filters],
  });
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];
  const categoryItems = flattenCategories(categories.data ?? []);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          results.isLoading ? (
            <MarketplaceState
              loading
              message="Searching approved marketplace inventory."
              title="Searching"
            />
          ) : results.isError ? (
            <MarketplaceState
              actionLabel="Retry"
              icon="cloud-off"
              message="Search is temporarily unavailable."
              onAction={() => void results.refetch()}
              title="Could not search"
            />
          ) : (
            <MarketplaceState
              icon="search-off"
              message="Try a broader phrase or remove one of your filters."
              title="No matching pieces"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>MARKETPLACE SEARCH</Text>
            <Text style={styles.heading}>Search the rack</Text>
            <View style={styles.searchBar}>
              <MaterialIcons color={marketplaceColors.muted} name="search" size={22} />
              <TextInput
                accessibilityLabel="Search listings"
                onChangeText={setDraftQuery}
                onSubmitEditing={() => setQuery(draftQuery.trim())}
                placeholder="Title, brand, category…"
                placeholderTextColor="#8B8E89"
                returnKeyType="search"
                style={styles.searchInput}
                value={draftQuery}
              />
              <Pressable onPress={() => setQuery(draftQuery.trim())} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>Go</Text>
              </Pressable>
            </View>
            <Text style={styles.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={categoryId === undefined}
                  label="All"
                  onPress={() => setCategoryId(undefined)}
                />
                {categoryItems.map((item) => (
                  <FilterChip
                    active={categoryId === item.id}
                    key={item.id}
                    label={item.name}
                    onPress={() => setCategoryId(item.id)}
                  />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.filterLabel}>Condition</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={condition === undefined}
                  label="Any"
                  onPress={() => setCondition(undefined)}
                />
                {conditions.map((item) => (
                  <FilterChip
                    active={condition === item}
                    key={item}
                    label={item.replaceAll('_', ' ')}
                    onPress={() => setCondition(item)}
                  />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.filterLabel}>Style</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={styleDefinitionId === undefined}
                  label="Any"
                  onPress={() => setStyleDefinitionId(undefined)}
                />
                {(styleDefinitions.data ?? []).map((item) => (
                  <FilterChip
                    active={styleDefinitionId === item.id}
                    key={item.id}
                    label={item.displayName}
                    onPress={() => setStyleDefinitionId(item.id)}
                  />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.filterLabel}>Color family</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={colorFamily === undefined}
                  label="Any"
                  onPress={() => setColorFamily(undefined)}
                />
                {colorFamilyValues.map((item) => (
                  <FilterChip
                    active={colorFamily === item}
                    key={item}
                    label={item}
                    onPress={() => setColorFamily(item)}
                  />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.filterLabel}>Fit & garment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={fitType === undefined}
                  label="Any fit"
                  onPress={() => setFitType(undefined)}
                />
                {fitTypeValues.map((item) => (
                  <FilterChip
                    active={fitType === item}
                    key={item}
                    label={item.replaceAll('_', ' ')}
                    onPress={() => setFitType(item)}
                  />
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <FilterChip
                  active={garmentRole === undefined}
                  label="Any garment"
                  onPress={() => setGarmentRole(undefined)}
                />
                {garmentRoleValues.map((item) => (
                  <FilterChip
                    active={garmentRole === item}
                    key={item}
                    label={item}
                    onPress={() => setGarmentRole(item)}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.inputRow}>
              <SmallInput label="Size" onChangeText={setSize} placeholder="M" value={size} />
              <SmallInput
                keyboardType="numeric"
                label="Min PKR"
                onChangeText={setMinimum}
                placeholder="1,000"
                value={minimum}
              />
              <SmallInput
                keyboardType="numeric"
                label="Max PKR"
                onChangeText={setMaximum}
                placeholder="20,000"
                value={maximum}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {sorts.map((item) => (
                  <FilterChip
                    active={sort === item.value}
                    key={item.value}
                    label={item.label}
                    onPress={() => setSort(item.value)}
                  />
                ))}
              </View>
            </ScrollView>
            <Text style={styles.resultCount}>{items.length} results loaded</Text>
          </View>
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={({ id }) => id}
        keyboardShouldPersistTaps="handled"
        numColumns={2}
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onLike={(listing) => actions.like.mutate(listing)}
            onSave={(listing) => actions.save.mutate(listing)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SmallInput(props: {
  readonly keyboardType?: 'numeric';
  readonly label: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly value: string;
}) {
  return (
    <View style={styles.smallField}>
      <Text style={styles.smallLabel}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#969891"
        style={styles.smallInput}
        value={props.value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#E8E3D9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: marketplaceColors.forest },
  chipRow: { flexDirection: 'row', gap: 7, paddingRight: 16 },
  chipText: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: marketplaceColors.white },
  content: { paddingBottom: 24, paddingHorizontal: 8 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  filterLabel: {
    color: marketplaceColors.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 16,
  },
  header: { paddingHorizontal: 10, paddingTop: 20 },
  heading: { color: marketplaceColors.forest, fontSize: 30, fontWeight: '900', marginTop: 7 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  resultCount: { color: marketplaceColors.muted, fontSize: 12, marginBottom: 8, marginTop: 18 },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  searchBar: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    paddingLeft: 14,
  },
  searchButton: {
    backgroundColor: marketplaceColors.accent,
    borderRadius: 12,
    margin: 5,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  searchButtonText: { color: marketplaceColors.white, fontWeight: '900' },
  searchInput: {
    color: marketplaceColors.text,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 13,
  },
  smallField: { flex: 1, gap: 5 },
  smallInput: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: marketplaceColors.text,
    padding: 11,
  },
  smallLabel: { color: marketplaceColors.muted, fontSize: 10, fontWeight: '800' },
});
