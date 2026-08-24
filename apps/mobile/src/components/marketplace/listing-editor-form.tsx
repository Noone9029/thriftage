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
import {
  marketplaceColors,
  marketplaceRadii,
  marketplaceShadows,
  marketplaceSpacing,
} from './marketplace-theme';

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
  const [success, setSuccess] = useState<string | null>(null);
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
  const finishAction = async (message: string): Promise<void> => {
    setError(null);
    setSuccess(message);
    await refresh();
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
      await finishAction(
        listing === undefined ? 'Draft created. Add your best photos next.' : 'Changes saved.',
      );
      onCreated?.(result);
    },
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (listing === undefined) return 0;
      const forms = await selectListingImages(10 - listing.images.length);
      for (const form of forms) await thriftageApiClient.uploadListingImage(listing.id, form);
      return forms.length;
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not upload images.'),
    onSuccess: async (count) => {
      if (count > 0)
        await finishAction(`${count} photo${count === 1 ? '' : 's'} added to your draft.`);
    },
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
  });
  const remove = useMutation({
    mutationFn: (imageId: string) =>
      listing === undefined
        ? Promise.reject(new Error('Save the draft first.'))
        : thriftageApiClient.removeListingImage(listing.id, imageId),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not remove this photo.'),
    onSuccess: () => finishAction('Photo removed.'),
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: readonly string[]) =>
      listing === undefined
        ? Promise.reject(new Error('Save the draft first.'))
        : thriftageApiClient.reorderListingImages(listing.id, ids),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not reorder these photos.'),
    onSuccess: () => finishAction('Photo order updated.'),
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
  });
  const submit = useMutation({
    mutationFn: () => thriftageApiClient.submitListing(listing?.id ?? ''),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not submit listing.'),
    onSuccess: () =>
      finishAction('Sent for review. We will let you know when it is ready to go live.'),
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
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
  const photoCount = listing?.images.length ?? 0;
  const currentStage = listing === undefined ? 0 : photoCount < 3 ? 1 : 2;
  const parsedPrice = Number(price.replaceAll(',', ''));
  const formReady =
    title.trim() !== '' &&
    description.trim() !== '' &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    categoryId !== '' &&
    styleDefinitionIds.length > 0 &&
    size.trim() !== '' &&
    !categories.isError &&
    !stylesQuery.isError;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.progressCard}>
        {['Describe it', 'Add photos', 'Submit'].map((label, index) => (
          <View key={label} style={styles.progressStep}>
            <View style={[styles.progressDot, index <= currentStage && styles.progressDotActive]}>
              {index < currentStage ? (
                <MaterialIcons color={marketplaceColors.white} name="check" size={13} />
              ) : (
                <Text
                  style={[
                    styles.progressNumber,
                    index <= currentStage && styles.progressNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[styles.progressLabel, index <= currentStage && styles.progressLabelActive]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
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
      {categories.isError || stylesQuery.isError ? (
        <View style={styles.errorCard}>
          <MaterialIcons color={marketplaceColors.danger} name="cloud-off" size={20} />
          <View style={styles.feedbackCopy}>
            <Text style={styles.feedbackTitle}>Listing options are offline</Text>
            <Text style={styles.feedbackText}>
              Categories or style tags could not be loaded. Your typed details are still here.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void categories.refetch();
              void stylesQuery.refetch();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.formCard}>
        <Text style={styles.sectionEyebrow}>THE ESSENTIALS</Text>
        <Text style={styles.formTitle}>Tell buyers why this piece stands out</Text>
        <Text style={styles.formCopy}>
          Clear details build trust and help the right buyer find it faster.
        </Text>
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
      </View>
      {listing !== undefined ? (
        <View style={styles.photoSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Listing photos</Text>
              <Text style={styles.sectionHint}>Add 3–10. The first image is the cover.</Text>
            </View>
            <Pressable
              accessibilityLabel="Add listing photos"
              accessibilityRole="button"
              accessibilityState={{
                busy: upload.isPending,
                disabled: !editable || listing.images.length >= 10 || upload.isPending,
              }}
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
                    <Pressable
                      accessibilityLabel={`Move photo ${index + 1} earlier`}
                      accessibilityRole="button"
                      disabled={index === 0 || reorder.isPending}
                      onPress={() => moveImage(index, -1)}
                    >
                      <MaterialIcons color={marketplaceColors.text} name="chevron-left" size={22} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      accessibilityRole="button"
                      disabled={remove.isPending}
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
                    <Pressable
                      accessibilityLabel={`Move photo ${index + 1} later`}
                      accessibilityRole="button"
                      disabled={index === listing.images.length - 1 || reorder.isPending}
                      onPress={() => moveImage(index, 1)}
                    >
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
        </View>
      ) : null}
      {success !== null ? (
        <View accessibilityLiveRegion="polite" style={styles.successCard}>
          <MaterialIcons color={marketplaceColors.success} name="check-circle" size={20} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}
      {error !== null ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: save.isPending || !formReady }}
          disabled={save.isPending || !formReady}
          onPress={() => save.mutate()}
          style={[styles.primary, (save.isPending || !formReady) && styles.disabled]}
        >
          <Text style={styles.primaryText}>
            {listing === undefined ? 'Create draft' : 'Save changes'}
          </Text>
        </Pressable>
      ) : null}
      {listing !== undefined && editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: listing.images.length < 3 || submit.isPending }}
          disabled={listing.images.length < 3 || submit.isPending}
          onPress={() => submit.mutate()}
          style={[styles.secondary, listing.images.length < 3 && styles.disabled]}
        >
          <Text style={styles.secondaryText}>Submit for review</Text>
        </Pressable>
      ) : null}
      {listing?.status === 'DRAFT' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: deleteDraft.isPending, disabled: deleteDraft.isPending }}
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
        accessibilityLabel={props.label}
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      {active ? <MaterialIcons color={marketplaceColors.white} name="check" size={13} /> : null}
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addPhoto: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: marketplaceRadii.md,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addPhotoText: { color: marketplaceColors.white, fontWeight: '800' },
  choice: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.sand,
    borderColor: 'transparent',
    borderRadius: marketplaceRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  choiceActive: { backgroundColor: marketplaceColors.forest },
  choiceText: { color: marketplaceColors.muted, fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: marketplaceColors.white },
  content: { gap: 15, padding: 20, paddingBottom: 70 },
  disabled: { opacity: 0.45 },
  destructive: { alignItems: 'center', padding: 13 },
  destructiveText: { color: marketplaceColors.danger, fontSize: 13, fontWeight: '900' },
  error: { color: marketplaceColors.danger, fontSize: 13, lineHeight: 20 },
  errorCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.dangerSoft,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: marketplaceSpacing.sm,
    padding: marketplaceSpacing.md,
  },
  feedbackCopy: { flex: 1 },
  feedbackText: { color: marketplaceColors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  feedbackTitle: { color: marketplaceColors.danger, fontSize: 12, fontWeight: '900' },
  field: { flex: 1, gap: 6 },
  formCard: {
    ...marketplaceShadows.card,
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: 15,
    padding: marketplaceSpacing.lg,
  },
  formCopy: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 18, marginTop: -8 },
  formTitle: { color: marketplaceColors.ink, fontSize: 20, fontWeight: '900', lineHeight: 25 },
  image: { height: 150, width: 112 },
  imageActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  imageCard: {
    backgroundColor: marketplaceColors.paper,
    borderRadius: marketplaceRadii.lg,
    overflow: 'hidden',
  },
  imageCount: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '700' },
  imageRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: marketplaceRadii.md,
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
    borderRadius: marketplaceRadii.lg,
    marginTop: 8,
    padding: 15,
  },
  primaryText: { color: marketplaceColors.white, fontSize: 15, fontWeight: '900' },
  rejection: { backgroundColor: '#F9E9DF', borderRadius: 14, gap: 5, padding: 14 },
  rejectionText: { color: '#714238', fontSize: 13, lineHeight: 19 },
  rejectionTitle: { color: marketplaceColors.danger, fontSize: 13, fontWeight: '900' },
  retryText: { color: marketplaceColors.accentDeep, fontSize: 11, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 10 },
  photoSection: {
    backgroundColor: marketplaceColors.forestSoft,
    borderColor: '#CBDAD1',
    borderRadius: marketplaceRadii.xl,
    borderWidth: 1,
    gap: marketplaceSpacing.md,
    padding: marketplaceSpacing.lg,
  },
  progressCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forestDeep,
    borderRadius: marketplaceRadii.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: marketplaceSpacing.lg,
  },
  progressDot: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  progressDotActive: {
    backgroundColor: marketplaceColors.accent,
    borderColor: marketplaceColors.accent,
  },
  progressLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', marginTop: 6 },
  progressLabelActive: { color: marketplaceColors.white },
  progressNumber: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '900' },
  progressNumberActive: { color: marketplaceColors.white },
  progressStep: { alignItems: 'center', flex: 1 },
  secondary: {
    alignItems: 'center',
    borderColor: marketplaceColors.forest,
    borderRadius: marketplaceRadii.lg,
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
  sectionEyebrow: {
    color: marketplaceColors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  sectionTitle: { color: marketplaceColors.text, fontSize: 18, fontWeight: '900' },
  status: { color: marketplaceColors.success, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  successCard: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.successSoft,
    borderRadius: marketplaceRadii.lg,
    flexDirection: 'row',
    gap: marketplaceSpacing.sm,
    padding: marketplaceSpacing.md,
  },
  successText: { color: marketplaceColors.success, flex: 1, fontSize: 11, lineHeight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
