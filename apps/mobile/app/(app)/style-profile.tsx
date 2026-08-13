import { MaterialIcons } from '@expo/vector-icons';
import {
  colorFamilyValues,
  fashionPriorityValues,
  fitTypeValues,
  lifestyleTypeValues,
  styleExpressionValues,
  type ColorFamily,
  type FitType,
  type StyleProfileInput,
} from '@thriftage/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarketplaceState } from '../../src/components/marketplace/marketplace-state';
import { marketplaceColors } from '../../src/components/marketplace/marketplace-theme';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';

const totalSteps = 6;
type ColorSelection = { colorFamily: ColorFamily; sentiment: 'PREFER' | 'AVOID' };

export default function StyleProfileScreen() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryFn: () => thriftageApiClient.getStyleProfile(),
    queryKey: ['personalization', 'profile'],
  });
  const styles = useQuery({
    queryFn: () => thriftageApiClient.getStyles(),
    queryKey: ['personalization', 'styles'],
    staleTime: 300_000,
  });
  const hydrated = useRef(false);
  const [step, setStep] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorSelection[]>([]);
  const [fits, setFits] = useState<FitType[]>([]);
  const [clothingSize, setClothingSize] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [lifestyles, setLifestyles] = useState<StyleProfileInput['lifestyles']>([]);
  const [expressions, setExpressions] = useState<StyleProfileInput['expressions']>([]);
  const [priorities, setPriorities] = useState<StyleProfileInput['priorities']>([]);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data === undefined || hydrated.current) return;
    hydrated.current = true;
    setStep(Math.min(profile.data.quizStep, totalSteps - 1));
    setSelectedStyles(profile.data.styles.map(({ styleDefinitionId }) => styleDefinitionId));
    setColors(profile.data.colors);
    setFits(profile.data.fits);
    setLifestyles(profile.data.lifestyles);
    setExpressions(profile.data.expressions);
    setPriorities(profile.data.priorities);
    setBudgetMin(
      profile.data.budgetMinMinor == null ? '' : String(profile.data.budgetMinMinor / 100),
    );
    setBudgetMax(
      profile.data.budgetMaxMinor == null ? '' : String(profile.data.budgetMaxMinor / 100),
    );
    setClothingSize(
      profile.data.sizes.find(
        ({ garmentRole, sizeSystem }) => garmentRole === 'TOP' && sizeSystem === 'ALPHA',
      )?.sizeKey ?? '',
    );
    setShoeSize(
      profile.data.sizes.find(
        ({ garmentRole, sizeSystem }) => garmentRole === 'SHOES' && sizeSystem === 'SHOE_EU',
      )?.sizeKey ?? '',
    );
  }, [profile.data]);

  const buildInput = (quizStep: number): StyleProfileInput => ({
    budgetMaxMinor: budgetMax.trim() === '' ? null : Math.round(Number(budgetMax) * 100),
    budgetMinMinor: budgetMin.trim() === '' ? null : Math.round(Number(budgetMin) * 100),
    colors,
    currency: 'PKR',
    expressions,
    fits,
    lifestyles,
    priorities,
    quizStep,
    sizes: [
      ...(clothingSize.trim() === ''
        ? []
        : [
            {
              garmentRole: 'TOP' as const,
              sizeKey: clothingSize.trim().toUpperCase(),
              sizeSystem: 'ALPHA' as const,
            },
          ]),
      ...(shoeSize.trim() === ''
        ? []
        : [
            {
              garmentRole: 'SHOES' as const,
              sizeKey: shoeSize.trim().toUpperCase(),
              sizeSystem: 'SHOE_EU' as const,
            },
          ]),
    ],
    styles: selectedStyles.map((styleDefinitionId, index) => ({
      styleDefinitionId,
      strength: Math.max(1, 5 - index),
    })),
  });
  const save = useMutation({
    mutationFn: ({ complete, nextStep }: { complete: boolean; nextStep: number }) =>
      thriftageApiClient.saveStyleProfile(buildInput(nextStep), complete),
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not save your style profile.'),
    onSuccess: async (result, variables) => {
      setError(null);
      queryClient.setQueryData(['personalization', 'profile'], result);
      await queryClient.invalidateQueries({ queryKey: ['marketplace', 'feed', 'RECOMMENDED'] });
      if (variables.complete) router.back();
      else setStep(variables.nextStep);
    },
  });
  const next = () => {
    if (step === 0 && selectedStyles.length === 0) return setError('Choose at least one style.');
    if (step === 4 && priorities.length === 0)
      return setError('Choose at least one fashion priority.');
    save.mutate({
      complete: step === totalSteps - 1,
      nextStep: Math.min(totalSteps - 1, step + 1),
    });
  };
  if (profile.isLoading || styles.isLoading)
    return (
      <MarketplaceState
        loading
        message="Loading your private style preferences."
        title="Opening style profile"
      />
    );
  if (profile.isError || styles.isError)
    return (
      <MarketplaceState
        actionLabel="Try again"
        message="Your style profile could not be loaded."
        onAction={() => {
          void profile.refetch();
          void styles.refetch();
        }}
        title="Style profile unavailable"
      />
    );

  return (
    <SafeAreaView style={screen.safeArea}>
      <View style={screen.topBar}>
        <Pressable accessibilityLabel="Close style profile" onPress={() => router.back()}>
          <MaterialIcons color={marketplaceColors.text} name="close" size={25} />
        </Pressable>
        <Text style={screen.step}>
          Step {step + 1} of {totalSteps}
        </Text>
        <Pressable onPress={() => router.push('/personalization-settings')}>
          <MaterialIcons color={marketplaceColors.forest} name="tune" size={23} />
        </Pressable>
      </View>
      <View style={screen.progress}>
        <View style={[screen.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={screen.content}>
        <Text style={screen.eyebrow}>YOUR STYLE, STRUCTURED</Text>
        {step === 0 ? (
          <QuizSection
            title="What feels most like you?"
            subtitle="Choose up to five. Your first choices carry more weight."
          >
            <ChoiceGrid
              values={(styles.data ?? []).map(({ id, displayName }) => ({
                label: displayName,
                value: id,
              }))}
              selected={selectedStyles}
              onToggle={(id) =>
                setSelectedStyles((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : current.length < 5
                      ? [...current, id]
                      : current,
                )
              }
            />
          </QuizSection>
        ) : null}
        {step === 1 ? (
          <QuizSection
            title="Build your color palette"
            subtitle="Tap once to prefer, twice to avoid, and again to clear."
          >
            <View style={screen.grid}>
              {colorFamilyValues.map((color) => {
                const selection = colors.find(({ colorFamily }) => colorFamily === color);
                return (
                  <Pressable
                    accessibilityLabel={`${color.replaceAll('_', ' ')} ${selection?.sentiment ?? 'not selected'}`}
                    key={color}
                    onPress={() =>
                      setColors((current) =>
                        selection === undefined
                          ? [...current, { colorFamily: color, sentiment: 'PREFER' }]
                          : selection.sentiment === 'PREFER'
                            ? current.map((item) =>
                                item.colorFamily === color ? { ...item, sentiment: 'AVOID' } : item,
                              )
                            : current.filter((item) => item.colorFamily !== color),
                      )
                    }
                    style={[
                      screen.choice,
                      selection?.sentiment === 'PREFER' && screen.choiceActive,
                      selection?.sentiment === 'AVOID' && screen.choiceAvoid,
                    ]}
                  >
                    <Text
                      style={[
                        screen.choiceText,
                        selection !== undefined && screen.choiceTextActive,
                      ]}
                    >
                      {color}
                    </Text>
                    <Text style={screen.choiceHint}>
                      {selection?.sentiment === 'PREFER'
                        ? 'Prefer'
                        : selection?.sentiment === 'AVOID'
                          ? 'Avoid'
                          : 'Neutral'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </QuizSection>
        ) : null}
        {step === 2 ? (
          <QuizSection
            title="How should pieces fit?"
            subtitle="Sizes are category-specific and never shown publicly."
          >
            <ChoiceGrid
              values={fitTypeValues.map((value) => ({ label: value.replaceAll('_', ' '), value }))}
              selected={fits}
              onToggle={(value) =>
                setFits((current) =>
                  current.includes(value as FitType)
                    ? current.filter((item) => item !== value)
                    : [...current, value as FitType],
                )
              }
            />
            <Text style={screen.fieldLabel}>Clothing size (XS–XXL)</Text>
            <TextInput
              accessibilityLabel="Preferred clothing size"
              autoCapitalize="characters"
              onChangeText={setClothingSize}
              placeholder="M"
              style={screen.input}
              value={clothingSize}
            />
            <Text style={screen.fieldLabel}>Shoe size (EU)</Text>
            <TextInput
              accessibilityLabel="Preferred EU shoe size"
              keyboardType="number-pad"
              onChangeText={setShoeSize}
              placeholder="42"
              style={screen.input}
              value={shoeSize}
            />
          </QuizSection>
        ) : null}
        {step === 3 ? (
          <QuizSection
            title="Style in real life"
            subtitle="These signals guide discovery without defining your identity."
          >
            <Text style={screen.fieldLabel}>Lifestyle</Text>
            <ChoiceGrid
              values={lifestyleTypeValues.map((value) => ({ label: value, value }))}
              selected={lifestyles}
              onToggle={(value) =>
                setLifestyles((current) =>
                  current.includes(value as never)
                    ? current.filter((item) => item !== value)
                    : [...current, value as never],
                )
              }
            />
            <Text style={screen.fieldLabel}>Expression</Text>
            <ChoiceGrid
              values={styleExpressionValues.map((value) => ({ label: value, value }))}
              selected={expressions}
              onToggle={(value) =>
                setExpressions((current) =>
                  current.includes(value as never)
                    ? current.filter((item) => item !== value)
                    : [...current, value as never],
                )
              }
            />
          </QuizSection>
        ) : null}
        {step === 4 ? (
          <QuizSection
            title="What matters when you shop?"
            subtitle="Declared priorities outweigh learned behavior."
          >
            <ChoiceGrid
              values={fashionPriorityValues.map((value) => ({ label: value, value }))}
              selected={priorities}
              onToggle={(value) =>
                setPriorities((current) =>
                  current.includes(value as never)
                    ? current.filter((item) => item !== value)
                    : [...current, value as never],
                )
              }
            />
            <View style={screen.budgetRow}>
              <View style={screen.budgetField}>
                <Text style={screen.fieldLabel}>Minimum PKR</Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setBudgetMin}
                  placeholder="0"
                  style={screen.input}
                  value={budgetMin}
                />
              </View>
              <View style={screen.budgetField}>
                <Text style={screen.fieldLabel}>Maximum PKR</Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setBudgetMax}
                  placeholder="Optional"
                  style={screen.input}
                  value={budgetMax}
                />
              </View>
            </View>
          </QuizSection>
        ) : null}
        {step === 5 ? (
          <QuizSection
            title="Your profile is ready"
            subtitle="Thriftage will use these structured preferences with recent activity to rank eligible listings. You can edit or reset this anytime."
          >
            <View style={screen.review}>
              <Text style={screen.resultEyebrow}>YOUR STYLE PROFILE</Text>
              <Text style={screen.resultStyle}>
                {profile.data?.result.primaryStyle?.displayName ?? 'Style mix'}
                {profile.data?.result.secondaryStyle === null ||
                profile.data?.result.secondaryStyle === undefined
                  ? ''
                  : ` + ${profile.data.result.secondaryStyle.displayName}`}
              </Text>
              <Text style={screen.reviewTitle}>
                {selectedStyles.length} styles · {colors.length} colors · {fits.length} fits
              </Text>
              <Text style={screen.reviewText}>
                Match percentages are deterministic, versioned, and only shown when relevant listing
                metadata is available.
              </Text>
              <Text style={screen.reviewText}>
                We do not collect height, weight, body type, or skin tone because the marketplace
                cannot use them responsibly yet.
              </Text>
            </View>
          </QuizSection>
        ) : null}
        {error !== null ? (
          <Text accessibilityRole="alert" style={screen.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={screen.footer}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((value) => value - 1)} style={screen.back}>
            <Text style={screen.backText}>Back</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={save.isPending} onPress={next} style={screen.primary}>
          <Text style={screen.primaryText}>
            {save.isPending
              ? 'Saving…'
              : step === totalSteps - 1
                ? 'Complete profile'
                : 'Save & continue'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function QuizSection({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <>
      <Text style={screen.title}>{title}</Text>
      <Text style={screen.subtitle}>{subtitle}</Text>
      <View style={screen.section}>{children}</View>
    </>
  );
}
function ChoiceGrid({
  onToggle,
  selected,
  values,
}: {
  onToggle: (value: string) => void;
  selected: readonly string[];
  values: readonly { label: string; value: string }[];
}) {
  return (
    <View style={screen.grid}>
      {values.map(({ label, value }) => (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.includes(value) }}
          key={value}
          onPress={() => onToggle(value)}
          style={[screen.choice, selected.includes(value) && screen.choiceActive]}
        >
          <Text style={[screen.choiceText, selected.includes(value) && screen.choiceTextActive]}>
            {label.replaceAll('_', ' ')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const screen = StyleSheet.create({
  back: {
    alignItems: 'center',
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backText: { color: marketplaceColors.text, fontWeight: '800' },
  budgetField: { flex: 1 },
  budgetRow: { flexDirection: 'row', gap: 12 },
  choice: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 62,
    padding: 13,
    width: '47%',
  },
  choiceActive: {
    backgroundColor: marketplaceColors.forest,
    borderColor: marketplaceColors.forest,
  },
  choiceAvoid: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  choiceHint: { color: '#C6C2B9', fontSize: 10, marginTop: 4 },
  choiceText: {
    color: marketplaceColors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  choiceTextActive: { color: marketplaceColors.white },
  content: { padding: 24, paddingBottom: 120 },
  error: { color: marketplaceColors.danger, fontWeight: '700', marginTop: 18 },
  eyebrow: { color: marketplaceColors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  fieldLabel: {
    color: marketplaceColors.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 20,
  },
  footer: {
    backgroundColor: marketplaceColors.background,
    borderTopColor: marketplaceColors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: marketplaceColors.text,
    padding: 14,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.forest,
    borderRadius: 14,
    flex: 1,
    padding: 16,
  },
  primaryText: { color: marketplaceColors.white, fontWeight: '900' },
  progress: { backgroundColor: marketplaceColors.border, height: 3 },
  progressFill: { backgroundColor: marketplaceColors.accent, height: 3 },
  review: {
    backgroundColor: marketplaceColors.paper,
    borderColor: marketplaceColors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  reviewText: { color: marketplaceColors.muted, fontSize: 14, lineHeight: 21 },
  reviewTitle: { color: marketplaceColors.forest, fontSize: 19, fontWeight: '900' },
  resultEyebrow: {
    color: marketplaceColors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  resultStyle: { color: marketplaceColors.forest, fontSize: 25, fontWeight: '900' },
  safeArea: { backgroundColor: marketplaceColors.background, flex: 1 },
  section: { marginTop: 26 },
  step: { color: marketplaceColors.muted, fontSize: 12, fontWeight: '800' },
  subtitle: { color: marketplaceColors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  title: {
    color: marketplaceColors.text,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 16,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
});
