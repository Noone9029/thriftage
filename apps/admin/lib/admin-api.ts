import {
  adminAiResponseFeedbackSchema,
  adminAiResponseFeedbackPageSchema,
  adminAccessSchema,
  adminBetaFeedbackSchema,
  adminBetaFeedbackPageSchema,
  adminListingDetailSchema,
  adminListingQueueSchema,
  categorySchema,
  moderationReportPageSchema,
  moderationReportSchema,
  type AdminListingDetail,
  type AdminAiResponseFeedback,
  type AdminBetaFeedback,
  type AdminListingQueueItem,
  type Category,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ListingStatus,
  type ModerationReport,
  type ModerationReportStatus,
  adminConversationDetailSchema,
  messageFlagPageSchema,
  messageFlagSchema,
  orderDetailSchema,
  orderPageSchema,
  type AdminConversationDetail,
  type MessageFlag,
  type OrderDetail,
  type OrderSummary,
  adminReviewReportPageSchema,
  adminUserDetailSchema,
  adminUserPageSchema,
  disputeDetailSchema,
  disputePageSchema,
  policyVersionSchema,
  restrictionSchema,
  reviewSchema,
  sellerVerificationPageSchema,
  sellerVerificationSchema,
  trustMetricsSchema,
  type AdminReviewReportItem,
  type AdminUserDetail,
  type AdminUserSummary,
  type DisputeAdminAction,
  type DisputeDetail,
  type DisputePage,
  type PolicyPublishInput,
  type PolicyVersion,
  type Restriction,
  type RestrictionInput,
  type Review,
  type ReviewAdminAction,
  type SafetyActionInput,
  type SellerVerification,
  type SellerVerificationDecision,
  type TrustMetrics,
  personalizationAdminSummarySchema,
  recommendationConfigurationSchema,
  styleDefinitionSchema,
  type PersonalizationAdminSummary,
  type RecommendationConfiguration,
  type RecommendationConfigurationInput,
  type StyleDefinition,
  aiStylistAdminMetricsSchema,
  aiStylistRuntimeConfigurationSchema,
  type AiStylistAdminMetrics,
  type AiStylistRuntimeConfiguration,
  feedbackModerationInputSchema,
  type FeedbackModerationInput,
  type FeedbackReviewStatus,
  closedBetaOperationsSchema,
  type ClosedBetaOperations,
} from '@thriftage/shared';

export class AdminApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  readonly body?: unknown;
  readonly method?: 'GET' | 'PATCH' | 'POST';
}

export class AdminApi {
  public constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {}

  public async verifyAccess(): Promise<void> {
    adminAccessSchema.parse(await this.request('/admin/access'));
  }

  public async getClosedBetaOperations(): Promise<ClosedBetaOperations> {
    return closedBetaOperationsSchema.parse(await this.request('/admin/closed-beta/snapshot'));
  }

  public async getAiStylistMetrics(): Promise<AiStylistAdminMetrics> {
    return aiStylistAdminMetricsSchema.parse(await this.request('/admin/ai-stylist/metrics'));
  }

  public async getAiStylistConfiguration(): Promise<AiStylistRuntimeConfiguration> {
    return aiStylistRuntimeConfigurationSchema.parse(
      await this.request('/admin/ai-stylist/configuration'),
    );
  }

  public async listBetaFeedback(
    status: FeedbackReviewStatus = 'OPEN',
  ): Promise<readonly AdminBetaFeedback[]> {
    return adminBetaFeedbackPageSchema.parse(
      await this.request(`/admin/feedback/beta?status=${encodeURIComponent(status)}`),
    ).items;
  }

  public async listAiResponseFeedback(
    status: FeedbackReviewStatus = 'OPEN',
  ): Promise<readonly AdminAiResponseFeedback[]> {
    return adminAiResponseFeedbackPageSchema.parse(
      await this.request(`/admin/feedback/ai?status=${encodeURIComponent(status)}`),
    ).items;
  }

  public async moderateBetaFeedback(
    id: string,
    input: FeedbackModerationInput,
  ): Promise<AdminBetaFeedback> {
    return adminBetaFeedbackSchema.parse(
      await this.request(`/admin/feedback/beta/${id}`, {
        body: feedbackModerationInputSchema.parse(input),
        method: 'PATCH',
      }),
    );
  }

  public async moderateAiResponseFeedback(
    id: string,
    input: FeedbackModerationInput,
  ): Promise<AdminAiResponseFeedback> {
    return adminAiResponseFeedbackSchema.parse(
      await this.request(`/admin/feedback/ai/${id}`, {
        body: feedbackModerationInputSchema.parse(input),
        method: 'PATCH',
      }),
    );
  }

  public async getPersonalizationSummary(): Promise<PersonalizationAdminSummary> {
    return personalizationAdminSummarySchema.parse(
      await this.request('/admin/personalization/summary'),
    );
  }

  public async getRecommendationConfigurations(): Promise<readonly RecommendationConfiguration[]> {
    return recommendationConfigurationSchema
      .array()
      .parse(await this.request('/admin/personalization/configuration'));
  }

  public async activateRecommendationConfiguration(
    input: RecommendationConfigurationInput,
  ): Promise<RecommendationConfiguration> {
    return recommendationConfigurationSchema.parse(
      await this.request('/admin/personalization/configuration', {
        body: input,
        method: 'POST',
      }),
    );
  }

  public async getStyleDefinitions(): Promise<readonly StyleDefinition[]> {
    return styleDefinitionSchema.array().parse(await this.request('/admin/personalization/styles'));
  }

  public async updateStyleDefinition(
    id: string,
    input: {
      displayName?: string;
      description?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ): Promise<StyleDefinition> {
    return styleDefinitionSchema.parse(
      await this.request(`/admin/personalization/styles/${id}`, { body: input, method: 'PATCH' }),
    );
  }

  public async listCategories(): Promise<readonly Category[]> {
    return categorySchema.array().parse(await this.request('/admin/categories'));
  }

  public async createCategory(input: CategoryCreateInput): Promise<Category> {
    return categorySchema.parse(
      await this.request('/admin/categories', { body: input, method: 'POST' }),
    );
  }

  public async updateCategory(id: string, input: CategoryUpdateInput): Promise<Category> {
    return categorySchema.parse(
      await this.request(`/admin/categories/${id}`, { body: input, method: 'PATCH' }),
    );
  }

  public async listListings(status: ListingStatus): Promise<readonly AdminListingQueueItem[]> {
    return adminListingQueueSchema.parse(await this.request(`/admin/listings?status=${status}`))
      .items;
  }

  public async getListing(id: string): Promise<AdminListingDetail> {
    return adminListingDetailSchema.parse(await this.request(`/admin/listings/${id}`));
  }

  public async moderateListing(
    id: string,
    action: 'approve' | 'reject' | 'remove',
    reason?: string,
  ): Promise<AdminListingDetail> {
    return adminListingDetailSchema.parse(
      await this.request(`/admin/listings/${id}/${action}`, {
        body: reason === undefined ? {} : { reason },
        method: 'POST',
      }),
    );
  }

  public async listReports(status?: ModerationReportStatus): Promise<readonly ModerationReport[]> {
    const query = status === undefined ? '' : `?status=${status}`;
    return moderationReportPageSchema.parse(await this.request(`/admin/reports${query}`)).items;
  }

  public async updateReport(
    id: string,
    status: 'ACTIONED' | 'DISMISSED' | 'UNDER_REVIEW',
    resolution?: string,
  ): Promise<ModerationReport> {
    return moderationReportSchema.parse(
      await this.request(`/admin/reports/${id}`, {
        body: resolution === undefined ? { status } : { resolution, status },
        method: 'PATCH',
      }),
    );
  }

  public async listMessageFlags(): Promise<readonly MessageFlag[]> {
    return messageFlagPageSchema.parse(await this.request('/admin/message-moderation/flags')).items;
  }
  public async getModeratedConversation(id: string): Promise<AdminConversationDetail> {
    return adminConversationDetailSchema.parse(
      await this.request(`/admin/message-moderation/conversations/${id}`),
    );
  }
  public async reviewMessageFlag(
    id: string,
    status: 'ACTIONED' | 'DISMISSED',
    resolution: string,
  ): Promise<MessageFlag> {
    return messageFlagSchema.parse(
      await this.request(`/admin/message-moderation/flags/${id}`, {
        body: { resolution, status },
        method: 'PATCH',
      }),
    );
  }
  public async listOrders(): Promise<readonly OrderSummary[]> {
    return orderPageSchema.parse(await this.request('/admin/orders')).items;
  }
  public async getOrder(id: string): Promise<OrderDetail> {
    return orderDetailSchema.parse(await this.request(`/admin/orders/${id}`));
  }
  public async getTrustMetrics(): Promise<TrustMetrics> {
    return trustMetricsSchema.parse(await this.request('/admin/trust/metrics'));
  }
  public async listTrustUsers(query?: string): Promise<readonly AdminUserSummary[]> {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : '';
    return adminUserPageSchema.parse(await this.request(`/admin/trust/users${suffix}`)).items;
  }
  public async getTrustUser(id: string): Promise<AdminUserDetail> {
    return adminUserDetailSchema.parse(await this.request(`/admin/trust/users/${id}`));
  }
  public async restrictUser(id: string, input: RestrictionInput): Promise<Restriction> {
    return restrictionSchema.parse(
      await this.request(`/admin/trust/users/${id}/restrictions`, { body: input, method: 'POST' }),
    );
  }
  public async revokeRestriction(id: string, reason: string): Promise<Restriction> {
    return restrictionSchema.parse(
      await this.request(`/admin/trust/restrictions/${id}/revoke`, {
        body: { reason },
        method: 'POST',
      }),
    );
  }
  public async takeSafetyAction(id: string, input: SafetyActionInput): Promise<void> {
    await this.request(`/admin/trust/users/${id}/actions`, { body: input, method: 'POST' });
  }
  public async publishPolicy(input: PolicyPublishInput): Promise<PolicyVersion> {
    return policyVersionSchema.parse(
      await this.request('/admin/trust/policies', { body: input, method: 'POST' }),
    );
  }
  public async listReviewReports(status?: string): Promise<readonly AdminReviewReportItem[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return adminReviewReportPageSchema.parse(await this.request(`/admin/reviews/reports${suffix}`))
      .items;
  }
  public async moderateReview(id: string, input: ReviewAdminAction): Promise<Review> {
    return reviewSchema.parse(
      await this.request(`/admin/reviews/${id}/moderate`, { body: input, method: 'POST' }),
    );
  }
  public async listDisputes(status?: string, query?: string): Promise<DisputePage> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (query) params.set('query', query);
    const suffix = params.size ? `?${params.toString()}` : '';
    return disputePageSchema.parse(await this.request(`/admin/disputes${suffix}`));
  }
  public async getDispute(id: string): Promise<DisputeDetail> {
    const payload = (await this.request(`/admin/disputes/${id}`)) as Record<string, unknown>;
    return disputeDetailSchema.strip().parse(payload);
  }
  public async actOnDispute(id: string, input: DisputeAdminAction): Promise<DisputeDetail> {
    return disputeDetailSchema.parse(
      await this.request(`/admin/disputes/${id}/actions`, { body: input, method: 'POST' }),
    );
  }
  public async listSellerVerifications(
    status?: string,
    query?: string,
  ): Promise<readonly SellerVerification[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (query) params.set('query', query);
    const suffix = params.size ? `?${params.toString()}` : '';
    return sellerVerificationPageSchema.parse(
      await this.request(`/admin/seller-verification${suffix}`),
    ).items;
  }
  public async decideSellerVerification(
    id: string,
    input: SellerVerificationDecision,
  ): Promise<SellerVerification> {
    return sellerVerificationSchema.parse(
      await this.request(`/admin/seller-verification/${id}/decision`, {
        body: input,
        method: 'POST',
      }),
    );
  }

  private async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: options.method ?? 'GET',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (response.ok) return response.status === 204 ? null : response.json();
    const body = (await response.json().catch(() => null)) as {
      readonly code?: string;
      readonly message?: string;
    } | null;
    throw new AdminApiError(
      body?.code ?? 'ADMIN_API_ERROR',
      body?.message ?? 'The admin operation failed.',
      response.status,
    );
  }
}

export function createAdminApi(accessToken: string): AdminApi {
  return new AdminApi(
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
    accessToken,
  );
}
