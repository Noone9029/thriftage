import 'dotenv/config';

import * as Sentry from '@sentry/node';
import { loadApiConfig } from '@thriftage/config/api';

import { redactSensitiveData } from './observability/sensitive-data';

const config = loadApiConfig(process.env);

if (config.sentryDsn !== undefined) {
  Sentry.init({
    beforeBreadcrumb: (breadcrumb) => redactSensitiveData(breadcrumb) as typeof breadcrumb,
    beforeSend: (event) => redactSensitiveData(event) as typeof event,
    dsn: config.sentryDsn,
    enabled: config.deploymentEnvironment !== 'local',
    environment: config.deploymentEnvironment,
    release: config.releaseVersion,
    sendDefaultPii: false,
    tracesSampleRate: config.sentryTracesSampleRate,
  });
}
