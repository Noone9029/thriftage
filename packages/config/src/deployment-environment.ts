import { z } from 'zod';

export const deploymentEnvironmentValues = ['local', 'staging', 'production'] as const;
export const deploymentEnvironmentSchema = z.enum(deploymentEnvironmentValues);

export type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;

const placeholderFragments = [
  'change-me',
  'example.com',
  'placeholder',
  'replace-with',
  'your-project',
] as const;

export function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return placeholderFragments.some((fragment) => normalized.includes(fragment));
}

export function isSecureRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !['127.0.0.1', 'localhost', '0.0.0.0'].includes(url.hostname) &&
      !isPlaceholderValue(value)
    );
  } catch {
    return false;
  }
}
