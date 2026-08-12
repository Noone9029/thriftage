import { Injectable } from '@nestjs/common';
import type { MessageFlagCategory } from '@thriftage/db';

export interface ContactDetection {
  readonly blocked: boolean;
  readonly category: MessageFlagCategory;
  readonly confidence: number;
  readonly detector: string;
}

const normalizedWords = (input: string): string =>
  input
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\b(at)\b/g, '@')
    .replaceAll(/\b(dot)\b/g, '.');

@Injectable()
export class ContactInformationDetector {
  public inspect(input: string): readonly ContactDetection[] {
    const normalized = normalizedWords(input);
    const detections: ContactDetection[] = [];
    if (
      /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com)\b/i.test(input) ||
      /\bwhats\s*app\b/i.test(input)
    ) {
      detections.push({
        blocked: true,
        category: 'WHATSAPP',
        confidence: 100,
        detector: 'whatsapp-reference-v1',
      });
    }
    if (
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input) ||
      /\b[A-Z0-9._%+-]+\s+(?:at|@)\s+[A-Z0-9.-]+\s+(?:dot|\.)\s+[A-Z]{2,}\b/i.test(input)
    ) {
      detections.push({
        blocked: true,
        category: 'EMAIL_ADDRESS',
        confidence: 100,
        detector: 'email-address-v1',
      });
    }
    const digitRuns = input.match(/(?:\+?\d[\s().-]*){8,15}/g) ?? [];
    if (digitRuns.some((candidate) => candidate.replaceAll(/\D/g, '').length >= 8)) {
      detections.push({
        blocked: true,
        category: 'PHONE_NUMBER',
        confidence: 95,
        detector: 'phone-number-v1',
      });
    }
    if (
      /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){6,}\b/i.test(
        input,
      )
    ) {
      detections.push({
        blocked: true,
        category: 'OBFUSCATED_CONTACT',
        confidence: 90,
        detector: 'spelled-digits-v1',
      });
    }
    if (
      /(?:^|\s)@[a-z0-9_.]{3,30}\b/i.test(input) &&
      !normalized.includes('@gmail.') &&
      !normalized.includes('@yahoo.')
    ) {
      detections.push({
        blocked: false,
        category: 'SOCIAL_HANDLE',
        confidence: 70,
        detector: 'social-handle-v1',
      });
    }
    return detections;
  }
}
