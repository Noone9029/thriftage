import { MaterialIcons } from '@expo/vector-icons';
import {
  colorFamilyValues,
  fitTypeValues,
  garmentRoleValues,
  sizeSystemValues,
  type ColorFamily,
  type FitType,
  type GarmentRole,
  type ListingCondition,
  type ListingDetail,
  type ListingDraftInput,
  type SizeSystem,
} from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { thriftageApiClient } from '../../lib/auth/auth-composition';
import { selectListingImages } from '../../lib/marketplace/listing-image-picker';
import { marketplaceColors } from './marketplace-theme';

const conditions: readonly ListingCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];

interface ListingEditorFormProps {
  readonly listing?: ListingDetail;
  readonly onCreated?: (listing: ListingDetail) => void;
  readonly onDeleted?: () => void;
}

export function ListingEditorForm({ listing, onCreated, onDeleted }: ListingEditorFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [price, setPrice] = useState(listing === undefined ? '' : String(listing.priceMinor / 100));
  const [size, setSize] = useState(listing?.size ?? '');
  const [brand, setBrand] = useState(listing?.brand ?? '');
  const [color, setColor] = useState(listing?.color ?? '');
  const [condition, setCondition] = useState<ListingCondition>(listing?.condition ?? 'GOOD');
  const [categoryId, setCategoryId] = useState(listing?.category.id ?? '');
  const [colorFamily, setColorFamily] = useState<ColorFamily>(
    listing?.personalization?.colorFamily ?? 'BLACK',
  );
  const [fitType, setFitType] = useState<FitType>(listing?.personalization?.fitType ?? 'REGULAR');
  const [garmentRole, setGarmentRole] = useState<GarmentRole>(
    listing?.personalization?.garmentRole ?? 'TOP',
  );
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>(
    listing?.personalization?.sizeSystem ?? 'ALPHA',
  );
  const [styleDefinitionIds, setStyleDefinitionIds] = useState<string[]>(
    listing?.personalization?.styles.map(({ id }) => id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const categories = useQuery({
    queryFn: () => thriftageApiClient.getCategories(),
    queryKey: ['marketplace', 'categories'],
  });
  const stylesQuery = useQuery({
    queryFn: () => thriftageApiClient.getStyles(),
    queryKey: ['personalization', 'styles'],
    staleTime: 300_000,
  });
  const categoryOptions = useMemo(
    () => (categories.data ?? []).flatMap((parent) => [parent, ...parent.children]),
    [categories.data],
  );

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['marketplace'] });
  };
  const save = useMutation({
    mutationFn: async () => {
      const parsedPrice = Number(price.replaceAll(',', ''));
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0)
        throw new Error('Enter a valid price.');
      const input: ListingDraftInput = {
        brand: brand.trim() || null,
        categoryId,
        color: color.trim() || null,
        condition,
        currency: 'PKR',
        description,
        priceMinor: Math.round(parsedPrice * 100),
        size,
        title,
        personalization: {
          colorFamily,
          fitType,
          garmentRole,
          sizeCompatibilityKey: size.trim().toUpperCase(),
          sizeSystem,
          styleDefinitionIds,
        },
      };
      return listing === undefined
        ? thriftageApiClient.createListing(input)
        : thriftageApiClient.updateListing(listing.id, input);
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not save listing.'),
    onSuccess: async (result) => {
      setError(null);
      await refresh();
      onCreated?.(result);
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (listing === undefined) return;
      const forms = await selectListingImages(10 - listing.images.length);
      for (const form of forms) await thriftageApiClient.uploadListingImage(listing.id, form);
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not upload images.'),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (imageId: string) =>
      listing === undefined
        ? Promise.reject(new Error('Save the draft first.'))
        : thriftageApiClient.removeListingImage(listing.id, imageId),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: readonly string[]) =>
      listing === undefined
        ? Promise.reject(new Error('Save the draft first.'))
        : thriftageApiClient.reorderListingImages(listing.id, ids),
    onSuccess: refresh,
  });
  const submit = useMutation({
    mutationFn: () => thriftageApiClient.submitListing(listing?.id ?? ''),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not submit listing.'),
    onSuccess: refresh,
  });
  const deleteDraft = useMutation({
    mutationFn: () => thriftageApiClient.deleteDraft(listing?.id ?? ''),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not delete this draft.'),
    onSuccess: async () => {
      await refresh();
      onDeleted?.();
    },
  });

  const moveImage = (index: number, direction: -1 | 1): void => {
    if (listing === undefined) return;
    const destination = index + direction;
    if (destination < 0 || destination >= listing.images.length) return;
    const ids = listing.images.map(({ id }) => id);
    const current = ids[index];
    const target = ids[destination];
    if (current === undefined || target === undefined) return;
    ids[index] = target;
    ids[destination] = current;
    reorder.mutate(ids);
  };

  const editable = listing === undefined || ['DRAFT', 'REJECTED'].includes(listing.status);
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {listing !== undefined ? (
        <View style={styles.statusRow}>
          <Text style={styles.status}>{listing.status.replaceAll('_', ' ')}</Text>
          <Text style={styles.imageCount}>{listing.images.length}/10 photos</Text>
        </View>
      ) : null}
      {listing?.rejectionReason !== null && listing?.rejectionReason !== undefined ? (
        <View style={styles.rejection}>
          <Text style={styles.rejectionTitle}>Changes requested</Text>
          <Text style={styles.rejectionText}>{listing.rejectionReason}</Text>
        </View>
      ) : null}
      <EditorField label="Title" onChangeText={setTitle} value={title} />
      <EditorField
        label="Description"
        multiline
        onChangeText={setDescription}
        value={description}
      />
      <View style={styles.row}>
        <EditorField
          keyboardType="numeric"
          label="Price (PKR)"
          onChangeText={setPrice}
          value={price}
        />
        <EditorField label="Size" onChangeText={setSize} value={size} />
      </View>
      <View style={styles.row}>
        <EditorField label="Brand (optional)" onChangeText={setBrand} value={brand} />
        <EditorField label="Color (optional)" onChangeText={setColor} value={color} />
      </View>
      <Text style={styles.label}>Condition</Text>
      <View style={styles.wrap}>
        {conditions.map((item) => (
          <Choice
            active={condition === item}
            key={item}
            label={item.replaceAll('_', ' ')}
            onPress={() => setCondition(item)}
          />
        ))}
      </View>
      <Text style={styles.label}>Category</Text>
      <View style={styles.wrap}>
        {categoryOptions.map((item) => (
          <Choice
            active={categoryId === item.id}
            key={item.id}
            label={item.name}
            onPress={() => setCategoryId(item.id)}
          />
        ))}
      </View>
      <Text style={styles.label}>Style tags (choose 1–5)</Text>
      <View style={styles.wrap}>
        {(stylesQuery.data ?? []).map((item) => (
          <Choice
            active={styleDefinitionIds.includes(item.id)}
            key={item.id}
            label={item.displayName}
            onPress={() =>
              setStyleDefinitionIds((current) =>
                current.includes(item.id)
                  ? current.filter((id) => id !== item.id)
                  : current.length < 5
                    ? [...current, item.id]
                    : current,
              )
            }
          />
        ))}
      </View>
      <Text style={styles.label}>Normalized color family</Text>
      <View style={styles.wrap}>
        {colorFamilyValues.map((item) => (
          <Choice
            active={colorFamily === item}
            key={item}
            label={item}
            onPress={() => setColorFamily(item)}
          />
        ))}
      </View>
      <Text style={styles.label}>Fit</Text>
      <View style={styles.wrap}>
        {fitTypeValues.map((item) => (
          <Choice
            active={fitType === item}
            key={item}
            label={item.replaceAll('_', ' ')}
            onPress={() => setFitType(item)}
          />
        ))}
      </View>
      <Text style={styles.label}>Garment role</Text>
      <View style={styles.wrap}>
        {garmentRoleValues.map((item) => (
          <Choice
            active={garmentRole === item}
            key={item}
            label={item}
            onPress={() => setGarmentRole(item)}
          />
        ))}
      </View>
      <Text style={styles.label}>Size system</Text>
      <View style={styles.wrap}>
        {sizeSystemValues.map((item) => (
          <Choice
            active={sizeSystem === item}
            key={item}
            label={item.replaceAll('_', ' ')}
            onPress={() => setSizeSystem(item)}
          />
        ))}
      </View>
      {listing !== undefined ? (
        <>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Listing photos</Text>
              <Text style={styles.sectionHint}>Add 3–10. The first image is the cover.</Text>
            </View>
            <Pressable
              disabled={!editable || listing.images.length >= 10 || upload.isPending}
              onPress={() => upload.mutate()}
              style={styles.addPhoto}
            >
              <MaterialIcons color={marketplaceColors.white} name="add-photo-alternate" size={18} />
              <Text style={styles.addPhotoText}>Add</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.imageRow}>
              {listing.images.map((image, index) => (
                <View key={image.id} style={styles.imageCard}>
                  <Image contentFit="cover" source={image.url} style={styles.image} />
                  <View style={styles.imageActions}>
                    <Pressable onPress={() => moveImage(index, -1)}>
                      <MaterialIcons color={marketplaceColors.text} name="chevron-left" size={22} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Remove photo?', 'This cannot be undone.', [
                          { style: 'cancel', text: 'Cancel' },
                          {
                            onPress: () => remove.mutate(image.id),
                            style: 'destructive',
                            text: 'Remove',
                          },
                        ])
                      }
                    >
                      <MaterialIcons
                        color={marketplaceColors.danger}
                        name="delete-outline"
                        size={20}
                      />
                    </Pressable>
                    <Pressable onPress={() => moveImage(index, 1)}>
                      <MaterialIcons
                        color={marketplaceColors.text}
                        name="chevron-right"
                        size={22}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {editable ? (
        <Pressable
          disabled={
            save.isPending ||
            categoryId === '' ||
            styleDefinitionIds.length === 0 ||
            size.trim() === ''
          }
          onPress={() => save.mutate()}
          style={[
            styles.primary,
            (save.isPending ||
              categoryId === '' ||
              styleDefinitionIds.length === 0 ||
              size.trim() === '') &&
              styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>
            {listing === undefined ? 'Create draft' : 'Save changes'}
          </Text>
        </Pressable>
      ) : null}
      {listing !== undefined && editable ? (
        <Pressable
          disabled={listing.images.length < 3 || submit.isPending}
          onPress={() => submit.mutate()}
          style={[styles.secondary, listing.images.length < 3 && styles.disabled]}
        >
          <Text style={styles.secondaryText}>Submit for review</Text>
        </Pressable>
      ) : null}
      {listing?.status === 'DRAFT' ? (
        <Pressable
          disabled={deleteDraft.isPending}
          onPress={() =>
            Alert.alert('Delete draft?', 'The draft and its photos will be permanently removed.', [
              { style: 'cancel', text: 'Cancel' },
              {
                onPress: () => deleteDraft.mutate(),
                style: 'destructive',
                text: 'Delete draft',
              },
            ])
          }
          style={styles.destructive}
        >
          <Text style={styles.destructiveText}>Delete draft</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function EditorField(props: {
  readonly keyboardType?: 'numeric';
  readonly label: string;
  readonly multiline?: boolean;
  readonly onChangeText: (value: string) => void;
  readonly value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        onChangeText={props.onChangeText}
        style={[styles.input, props.multiline && styles.multiline]}
        value={props.value}
      />
    </View>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addPhoto: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addPhotoText: { color: marketplaceColors.white, fontWeight: '800' },
  choice: {
    backgroundColor: '#E8E3D9',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  choiceActive: { backgroundColor: marketplaceColors.forest },
  choiceText: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: marketplaceColors.white },
  content: { gap: 15, padding: 20, paddingBottom: 50 },
  disabled: { opacity: 0.45 },
  destructive: { alignItems: 'center', padding: 13 },
  destructiveText: { color: marketplaceColors.danger, fontSize: 13, fontWeight: '900' },
  error: { color: marketplaceColors.danger, fontSize: 13, lineHeight: 20 },
  field: { flex: 1, gap: 6 },
  image: { height: 150, width: 112 },
  imageActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  imageCard: { backgroundColor: marketplaceColors.paper, borderRadius: 12, overflow: 'hidden' },
  imageCount: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '700' },
  imageRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: marketplaceColors.text,
    fontSize: 15,
    padding: 13,
  },
  label: { color: marketplaceColors.text, fontSize: 12, fontWeight: '800' },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.accent,
    borderRadius: 15,
    marginTop: 8,
    padding: 15,
  },
  primaryText: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
  rejection: { backgroundColor: '#F9E9DF', borderRadius: 14, gap: 5, padding: 14 },
  rejectionText: { color: '#714238', fontSize: 13, lineHeight: 19 },
  rejectionTitle: { color: marketplaceColors.danger, fontSize: 13, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 10 },
  secondary: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
  },
  secondaryText: { color: marketplaceColors.forest, fontSize: 14, fontWeight: '900' },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionHint: { color: marketplaceColors.muted, fontSize: 11, marginTop: 3 },
  sectionTitle: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900' },
  status: { color: marketplaceColors.success, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
