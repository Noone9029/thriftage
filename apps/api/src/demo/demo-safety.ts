import { DEMO_CONFIRMATION, DEMO_PROJECT_REF } from './demo-marketplace.manifest';

export interface DemoSeedTarget {
  readonly deploymentEnvironment: 'local' | 'staging';
  readonly projectRef: string;
}

export function assertDemoSeedTarget(environment: NodeJS.ProcessEnv): DemoSeedTarget {
  const deploymentEnvironment = environment.DEPLOYMENT_ENV?.trim().toLowerCase();
  if (deploymentEnvironment !== 'local' && deploymentEnvironment !== 'staging') {
    throw new Error(
      'Demo marketplace tooling is restricted to an explicit local or staging target.',
    );
  }
  if (environment.ALLOW_DEMO_MARKETPLACE_SEED !== DEMO_CONFIRMATION) {
    throw new Error('Demo marketplace confirmation is missing or invalid.');
  }
  const rawUrl = environment.SUPABASE_URL;
  if (rawUrl === undefined || rawUrl.trim() === '') {
    throw new Error('SUPABASE_URL is required for demo marketplace tooling.');
  }
  const host = new URL(rawUrl).hostname.toLowerCase();
  const projectRef = host.split('.')[0] ?? '';
  if (deploymentEnvironment === 'staging') {
    if (
      environment.DEMO_SUPABASE_PROJECT_REF !== DEMO_PROJECT_REF ||
      projectRef !== DEMO_PROJECT_REF
    ) {
      throw new Error(
        'Refusing demo marketplace tooling because the staging project identity does not match.',
      );
    }
  } else if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Local demo marketplace tooling requires a loopback Supabase URL.');
  }
  return { deploymentEnvironment, projectRef };
}
