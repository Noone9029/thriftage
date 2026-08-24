import { MaterialIcons } from '@expo/vector-icons';
import {
  colorFamilyValues,
  fitTypeValues,
  garmentRoleValues,
  type CategoryTreeNode,
  type ColorFamily,
  type FitType,
  type GarmentRole,
  type ListingCondition,
  type ListingDetail,
  type ListingPage,
  type ListingSearchQuery,
} from '@thriftage/shared';
import { type InfiniteData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '../../../src/components/marketplace/listing-card';
import { ScreenHeader } from '../../../src/components/marketplace/marketplace-primitives';
import { ListingGridSkeleton } from '../../../src/components/marketplace/marketplace-skeleton';
import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from '../../../src/components/marketplace/marketplace-theme';
import { useListingActions } from '../../../src/hooks/use-listing-actions';
import { thriftageApiClient } from '../../../src/lib/auth/auth-composition';

const conditions: readonly ListingCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];
const sorts: readonly { readonly label: string; readonly value: ListingSearchQuery['sort'] }[] = [
  { label: 'For you', value: 'PERSONALIZED' },
  { label: 'Newest', value: 'NEWEST' },
  { label: 'Price: low', value: 'PRICE_LOW' },
  { label: 'Price: high', value: 'PRICE_HIGH' },
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
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);
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
  const selectedFilterCount = [
    categoryId,
    condition,
    size.trim() || undefined,
    minimum.trim() || undefined,
    maximum.trim() || undefined,
    styleDefinitionId,
    colorFamily,
    fitType,
    garmentRole,
  ].filter((value) => value !== undefined).length;

  const clearFilters = () => {
    setCategoryId(undefined);
    setCondition(undefined);
    setSize('');
    setMinimum('');
    setMaximum('');
    setStyleDefinitionId(undefined);
    setColorFamily(undefined);
    setFitType(undefined);
    setGarmentRole(undefined);
    setSort('NEWEST');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList<ListingDetail>
        ListEmptyComponent={
          results.isLoading ? (
            <ListingGridSkeleton />
          ) : results.isError ? (
            <MarketplaceState
              actionLabel="Search again"
              icon="cloud-off"
              message="The rack could not be searched right now. Your filters are still here."
              onAction={() => void results.refetch()}
              title="Search stepped away"
            />
          ) : (
            <MarketplaceState
              icon="search-off"
              message="Try a broader phrase, a different category, or fewer filters."
              title="No perfect match yet"
              {...(selectedFilterCount > 0
                ? { actionLabel: 'Clear filters', onAction: clearFilters }
                : {})}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              eyebrow="FIND YOUR NEXT FAVORITE"
              subtitle="Search real wardrobes by piece, brand, mood, or fit."
              title="Explore the rack"
            />
            <View style={styles.searchBar}>
              <MaterialIcons color={marketplaceColors.muted} name="search" size={23} />
              <TextInput
                accessibilityLabel="Search listings"
                onChangeText={setDraftQuery}
                onSubmitEditing={() => setQuery(draftQuery.trim())}
                placeholder="Try “vintage denim”"
                placeholderTextColor={marketplaceColors.mutedLight}
                returnKeyType="search"
                style={styles.searchInput}
                value={draftQuery}
              />
              {draftQuery === '' ? null : (
                <Pressable
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  onPress={() => {
                    setDraftQuery('');
                    setQuery('');
                  }}
                >
                  <MaterialIcons color={marketplaceColors.muted} name="cancel" size={19} />
                </Pressable>
              )}
              <Pressable
                accessibilityLabel="Run search"
                accessibilityRole="button"
                onPress={() => setQuery(draftQuery.trim())}
                style={styles.searchButton}
              >
                <MaterialIcons color={marketplaceColors.white} name="arrow-forward" size={20} />
              </Pressable>
            </View>

            <View style={styles.controlRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showFilters }}
                onPress={() => setShowFilters((current) => !current)}
                style={[styles.filterButton, showFilters && styles.filterButtonActive]}
              >
                <MaterialIcons
                  color={showFilters ? marketplaceColors.white : marketplaceColors.forest}
                  name="tune"
                  size={18}
                />
                <Text
                  style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}
                >
                  Filters{selectedFilterCount > 0 ? ` · ${selectedFilterCount}` : ''}
                </Text>
              </Pressable>
              {selectedFilterCount > 0 ? (
                <Pressable accessibilityRole="button" onPress={clearFilters}>
                  <Text style={styles.clearText}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>

            {showFilters ? (
              <View style={styles.filterPanel}>
                <FilterSection label="Category">
                  <FilterChip
                    active={categoryId === undefined}
                    label="All pieces"
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
                </FilterSection>
                <FilterSection label="Condition">
                  <FilterChip
                    active={condition === undefined}
                    label="Any condition"
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
                </FilterSection>
                <FilterSection label="Style">
                  <FilterChip
                    active={styleDefinitionId === undefined}
                    label="Any style"
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
                </FilterSection>
                <FilterSection label="Color">
                  <FilterChip
                    active={colorFamily === undefined}
                    label="Any color"
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
                </FilterSection>
                <FilterSection label="Fit">
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
                </FilterSection>
                <FilterSection label="Garment">
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
                </FilterSection>
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
              </View>
            ) : null}

            <Text style={styles.sortLabel}>SORT THE EDIT</Text>
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
            <View style={styles.resultsRow}>
              <Text style={styles.resultTitle}>
                {query === '' ? 'Marketplace pieces' : `Results for “${query}”`}
              </Text>
              <Text style={styles.resultCount}>{items.length} loaded</Text>
            </View>
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

function FilterSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>{children}</View>
      </ScrollView>
    </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {active ? <MaterialIcons color={marketplaceColors.white} name="check" size={13} /> : null}
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
        accessibilityLabel={props.label}
        keyboardType={props.keyboardType}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={marketplaceColors.mutedLight}
        style={styles.smallInput}
        value={props.value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.sand,
    borderColor: 'transparent',
    borderRadius: marketplaceRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  chipActive: { backgroundColor: marketplaceColors.forest, borderColor: marketplaceColors.forest },
  chipRow: { flexDirection: 'row', gap: 7, paddingRight: 16 },
  chipText: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: marketplaceColors.white },
  clearText: { color: marketplaceColors.accentDeep, fontSize: 12, fontWeight: '900' },
  content: { paddingBottom: 32, paddingHorizontal: 8 },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: marketplaceSpacing.md,
  },
  filterButton: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: marketplaceRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 15,
  },
  filterButtonActive: { backgroundColor: marketplaceColors.forest },
  filterButtonText: { color: marketplaceColors.forest, fontSize: 12, fontWeight: '900' },
  filterButtonTextActive: { color: marketplaceColors.white },
  filterLabel: {
    color: marketplaceColors.text,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  },
  filterPanel: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    marginTop: marketplaceSpacing.md,
    padding: marketplaceSpacing.lg,
  },
  filterSection: { marginBottom: marketplaceSpacing.lg },
  header: { paddingHorizontal: 10, paddingTop: 18 },
  inputRow: { flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.75 },
  resultCount: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '700' },
  resultTitle: { color: marketplaceColors.text, flex: 1, fontSize: 18, fontWeight: '900' },
  resultsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 9,
    marginTop: 28,
  },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  searchBar: {
    ...marketplaceShadows.card,
    alignItems: 'center',
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: marketplaceSpacing.xl,
    paddingLeft: 15,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: marketplaceRadii.lg,
    height: 46,
    justifyContent: 'center',
    margin: 5,
    width: 46,
  },
  searchInput: {
    color: marketplaceColors.text,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  smallField: { flex: 1, gap: 6 },
  smallInput: {
    backgroundColor: marketplaceColors.background,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
    borderWidth: 1,
    color: marketplaceColors.text,
    padding: 11,
  },
  smallLabel: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '900' },
  sortLabel: {
    color: marketplaceColors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 9,
    marginTop: marketplaceSpacing.xl,
  },
});
