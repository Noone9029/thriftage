import { Injectable } from '@nestjs/common';
import { loadApiConfig } from '@thriftage/config/api';
import { getPrismaClient } from '@thriftage/db';
import {
  API_SERVICE_NAME,
  publicRuntimeConfigSchema,
  type HealthResponse,
  type PublicRuntimeConfig,
  type ReadinessResponse,
} from '@thriftage/shared';

@Injectable()
export class HealthService {
  public getRuntimeConfig(): PublicRuntimeConfig {
    const config = loadApiConfig(process.env);
    return publicRuntimeConfigSchema.parse({
      environment: config.deploymentEnvironment,
      commerce: {
        commissionBps: config.marketplaceCommissionBps,
        deliveryCities: config.localCourierServiceCities,
        deliveryCountryCode: config.localCourierServiceCountryCode,
        lahoreDeliveryFeeMinor: config.lahoreDeliveryFeeMinor,
        paymentExpiryMinutes: config.paymentExpiryMinutes as 15,
      },
      features: {
        accountDeletion: config.accountDeletionEnabled,
        aiStylist: config.aiStylistEnabled,
        phoneAuth: config.phoneAuthEnabled,
        pushNotifications: config.expoPushEnabled,
        registration: config.registrationEnabled,
        sellerVerification: config.sellerVerificationEnabled,
        cashOnDelivery: config.codEnabled,
        localCourier: config.localCourierEnabled,
        payfast: config.payfastEnabled,
        payouts: config.payoutsEnabled,
      },
      links: {
        accountDeletion: config.accountDeletionUrl ?? null,
        communityGuidelines: config.communityGuidelinesUrl ?? null,
        privacyPolicy: config.privacyPolicyUrl ?? null,
        support: config.supportUrl ?? null,
        termsOfUse: config.termsOfUseUrl ?? null,
      },
      releaseVersion: config.releaseVersion,
    });
  }

  public getHealth(): HealthResponse {
    const config = loadApiConfig(process.env);
    return {
      environment: config.deploymentEnvironment,
      releaseVersion: config.releaseVersion,
      service: API_SERVICE_NAME,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<ReadinessResponse> {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return { ...this.getHealth(), status: 'ready' };
  }
}
