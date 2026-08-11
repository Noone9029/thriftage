import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { thriftageApiClient } from '../../lib/auth/auth-composition';
import { marketplaceColors } from './marketplace-theme';

const reasons = [
  'COUNTERFEIT',
  'FRAUD_OR_SCAM',
  'PROHIBITED_ITEM',
  'MISLEADING_CONTENT',
  'HARASSMENT',
  'SPAM',
  'OTHER',
] as const;

interface ReportPanelProps {
  readonly listingId?: string;
  readonly onClose: () => void;
  readonly userId?: string;
}

export function ReportPanel({ listingId, onClose, userId }: ReportPanelProps) {
  const [reason, setReason] = useState<(typeof reasons)[number]>('MISLEADING_CONTENT');
  const [detail, setDetail] = useState('');
  const report = useMutation({
    mutationFn: () => {
      if (listingId !== undefined) {
        return thriftageApiClient.reportListing({ detail: detail || undefined, listingId, reason });
      }
      if (userId !== undefined) {
        return thriftageApiClient.reportUser({ detail: detail || undefined, reason, userId });
      }
      return Promise.reject(new Error('Report target is unavailable.'));
    },
  });
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Report to Thriftage</Text>
      <Text style={styles.copy}>
        Reports are private and reviewed by authorized marketplace staff.
      </Text>
      <View style={styles.reasons}>
        {reasons.map((item) => (
          <Pressable
            key={item}
            onPress={() => setReason(item)}
            style={[styles.reason, reason === item && styles.reasonActive]}
          >
            <Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>
              {item.replaceAll('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        multiline
        onChangeText={setDetail}
        placeholder="Add helpful context (optional)"
        placeholderTextColor="#8B8E89"
        style={styles.input}
        value={detail}
      />
      {report.isError ? (
        <Text style={styles.error}>This report could not be submitted.</Text>
      ) : null}
      {report.isSuccess ? (
        <View style={styles.success}>
          <Text style={styles.successText}>
            Report submitted. Thank you for helping keep Thriftage safe.
          </Text>
        </View>
      ) : (
        <Pressable
          disabled={report.isPending}
          onPress={() => report.mutate()}
          style={styles.submit}
        >
          <Text style={styles.submitText}>
            {report.isPending ? 'Submitting…' : 'Submit report'}
          </Text>
        </Pressable>
      )}
      <Pressable onPress={onClose}>
        <Text style={styles.cancel}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cancel: { color: marketplaceColors.muted, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  copy: { color: marketplaceColors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: marketplaceColors.danger, fontSize: 12 },
  input: {
    backgroundColor: marketplaceColors.white,
    borderColor: marketplaceColors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
  },
  panel: {
    backgroundColor: '#F9F5ED',
    borderColor: marketplaceColors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
    padding: 16,
  },
  reason: {
    backgroundColor: '#E7E1D6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reasonActive: { backgroundColor: marketplaceColors.danger },
  reasonText: { color: marketplaceColors.muted, fontSize: 9, fontWeight: '800' },
  reasonTextActive: { color: marketplaceColors.white },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  submit: {
    alignItems: 'center',
    backgroundColor: marketplaceColors.danger,
    borderRadius: 12,
    padding: 13,
  },
  submitText: { color: marketplaceColors.white, fontWeight: '900' },
  success: { backgroundColor: '#DDECE5', borderRadius: 12, padding: 12 },
  successText: { color: marketplaceColors.success, fontSize: 12, fontWeight: '700' },
  title: { color: marketplaceColors.text, fontSize: 17, fontWeight: '900' },
});
