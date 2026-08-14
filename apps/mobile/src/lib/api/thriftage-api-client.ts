import {
  categoryTreeNodeSchema,
  listingDetailSchema,
  listingPageSchema,
  moderationReportSchema,
  phoneVerificationChallengeSchema,
  privateUserAccountSchema,
  privateUserProfileSchema,
  publicUserProfileSchema,
  sellerProfileWithListingsSchema,
  socialActionResultSchema,
  usernameAvailabilitySchema,
  type CategoryTreeNode,
  type FeedMode,
  type ListingDetail,
  type ListingDraftInput,
  type ListingPage,
  type ListingReportInput,
  type ListingSearchQuery,
  type ListingUpdateInput,
  type ModerationReport,
  type PhoneVerificationChallenge,
  type PrivateUserAccount,
  type PrivateUserProfile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  type PublicUserProfile,
  type SellerProfileWithListings,
  type SocialActionResult,
  type UserReportInput,
  type UsernameAvailability,
  addressInputSchema,
  addressSchema,
  conversationDetailSchema,
  conversationPageSchema,
  messagePageSchema,
  messageSchema,
  notificationPageSchema,
  orderDetailSchema,
  orderPageSchema,
  pushDeviceSchema,
  type Address,
  type AddressInput,
  type CheckoutInput,
  type ConversationDetail,
  type ConversationPage,
  type Message,
  type MessagePage,
  type NotificationPage,
  type OrderDetail,
  type OrderPage,
  type PushDevice,
  type PushDeviceInput,
  type ShipmentInput,
  blockPageSchema,
  currentPolicyPageSchema,
  disputeDetailSchema,
  disputeEvidenceSchema,
  disputePageSchema,
  reviewEligibilitySchema,
  reviewPageSchema,
  reviewReportSchema,
  reviewSchema,
  safetyStatusSchema,
  sellerVerificationEligibilitySchema,
  sellerVerificationSchema,
  type CurrentPolicyPage,
  type DisputeCreateInput,
  type DisputeDetail,
  type DisputePage,
  type DisputeEvidence,
  type Review,
  type ReviewCreateInput,
  type ReviewEligibility,
  type ReviewPage,
  type ReviewReport,
  type ReviewReportInput,
  type SafetyStatus,
  type SellerVerification,
  type SellerVerificationEligibility,
  type UserBlock,
  userBlockSchema,
  privacyStatusSchema,
  recommendationEventInputSchema,
  recommendationFeedbackSchema,
  styleDefinitionSchema,
  styleProfileInputSchema,
  styleProfileSchema,
  type RecommendationEventInput,
  type StyleDefinition,
  type StyleProfile,
  type StyleProfileInput,
  aiStylistAttributionInputSchema,
  aiStylistConversationCreateInputSchema,
  aiStylistConversationDetailSchema,
  aiStylistConversationPageSchema,
  aiStylistGenerationResultSchema,
  aiStylistMessageInputSchema,
  replaceSavedOutfitItemInputSchema,
  savedOutfitPageSchema,
  savedOutfitSchema,
  saveOutfitInputSchema,
  type AiStylistAttributionInput,
  type AiStylistConversationCreateInput,
  type AiStylistConversationDetail,
  type AiStylistConversationPage,
  type AiStylistGenerationResult,
  type AiStylistMessageInput,
  type ReplaceSavedOutfitItemInput,
  type SavedOutfit,
  type SavedOutfitPage,
  type SaveOutfitInput,
} from '@thriftage/shared';

import { decodeApiError, MobileApiError } from './mobile-api-error';

export interface ApiSessionProvider {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
  sessionBecameInvalid(): void;
}

interface RequestOptions {
  readonly authenticated?: boolean;
  readonly body?: unknown;
  readonly method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  readonly signal?: AbortSignal;
}

const refreshableCodes = new Set(['AUTH_EXPIRED_TOKEN', 'AUTH_INVALID_TOKEN']);

function queryString(values: Readonly<Record<string, string | number | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const result = params.toString();
  return result === '' ? '' : `?${result}`;
}

export class ThriftageApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly sessionProvider: ApiSessionProvider,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async getCurrentAccount(): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(await this.request('/auth/me'));
  }

  public async provisionUser(fullName: string): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(
      await this.request('/auth/provision', { body: { fullName }, method: 'POST' }),
    );
  }

  public async getHealth(): Promise<unknown> {
    return this.request('/health', { authenticated: false });
  }

  public async getCurrentPhoneVerification(): Promise<PhoneVerificationChallenge | null> {
    const result = await this.request('/auth/phone-verification/current');
    return result === null ? null : phoneVerificationChallengeSchema.parse(result);
  }

  public async startPhoneVerification(phone: string): Promise<PhoneVerificationChallenge> {
    return phoneVerificationChallengeSchema.parse(
      await this.request('/auth/phone-verification/start', { body: { phone }, method: 'POST' }),
    );
  }

  public async verifyPhone(attemptId: string, code: string): Promise<PrivateUserAccount> {
    return privateUserAccountSchema.parse(
      await this.request('/auth/phone-verification/verify', {
        body: { attemptId, code },
        method: 'POST',
      }),
    );
  }

  public async resendPhoneVerification(attemptId: string): Promise<PhoneVerificationChallenge> {
    return phoneVerificationChallengeSchema.parse(
      await this.request(`/auth/phone-verification/${attemptId}/resend`, { method: 'POST' }),
    );
  }

  public async cancelPhoneVerification(): Promise<void> {
    await this.request('/auth/phone-verification/current', { method: 'DELETE' });
  }

  public async getCurrentProfile(): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(await this.request('/profiles/me'));
  }

  public async createProfile(input: ProfileCreateInput): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles', { body: input, method: 'POST' }),
    );
  }

  public async updateProfile(input: ProfileUpdateInput): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me', { body: input, method: 'PATCH' }),
    );
  }

  public async getUsernameAvailability(username: string): Promise<UsernameAvailability> {
    return usernameAvailabilitySchema.parse(
      await this.request(
        `/profiles/username-availability?username=${encodeURIComponent(username)}`,
      ),
    );
  }

  public async getPublicProfile(username: string): Promise<PublicUserProfile> {
    return publicUserProfileSchema.parse(
      await this.request(`/profiles/${encodeURIComponent(username)}`, { authenticated: false }),
    );
  }

  public async uploadProfileImage(form: FormData): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me/image', { body: form, method: 'POST' }),
    );
  }

  public async removeProfileImage(): Promise<PrivateUserProfile> {
    return privateUserProfileSchema.parse(
      await this.request('/profiles/me/image', { method: 'DELETE' }),
    );
  }

  public async getCategories(): Promise<readonly CategoryTreeNode[]> {
    return categoryTreeNodeSchema
      .array()
      .parse(await this.request('/categories', { authenticated: false }));
  }

  public async getFeed(mode: FeedMode, cursor?: string, limit = 20): Promise<ListingPage> {
    return listingPageSchema.parse(
      await this.request(`/feed${queryString({ cursor, limit, mode })}`),
    );
  }

  public async getStyles(): Promise<readonly StyleDefinition[]> {
    return styleDefinitionSchema
      .array()
      .parse(await this.request('/styles', { authenticated: false }));
  }

  public async getStyleProfile(): Promise<StyleProfile> {
    return styleProfileSchema.parse(await this.request('/me/style-profile'));
  }

  public async saveStyleProfile(input: StyleProfileInput, complete = false): Promise<StyleProfile> {
    return styleProfileSchema.parse(
      await this.request(complete ? '/me/style-profile/complete' : '/me/style-profile', {
        body: (complete ? styleProfileInputSchema : styleProfileInputSchema).parse(input),
        method: complete ? 'POST' : 'PUT',
      }),
    );
  }

  public async resetStyleProfile(): Promise<StyleProfile> {
    return styleProfileSchema.parse(await this.request('/me/style-profile', { method: 'DELETE' }));
  }

  public async getPersonalizationPrivacy() {
    return privacyStatusSchema.parse(await this.request('/me/personalization/privacy'));
  }

  public async resetLearnedSignals(): Promise<{ behavioralResetAt: string }> {
    return (await this.request('/me/personalization/learned-signals', { method: 'DELETE' })) as {
      behavioralResetAt: string;
    };
  }

  public async setNotInterested(listingId: string, hidden: boolean) {
    return recommendationFeedbackSchema.parse(
      await this.request(`/listings/${listingId}/not-interested`, {
        method: hidden ? 'PUT' : 'DELETE',
      }),
    );
  }

  public async recordRecommendationEvent(input: RecommendationEventInput): Promise<void> {
    await this.request('/me/personalization/events', {
      body: recommendationEventInputSchema.parse(input),
      method: 'POST',
    });
  }

  public async createStylistConversation(
    input: AiStylistConversationCreateInput = {},
  ): Promise<AiStylistConversationDetail> {
    return aiStylistConversationDetailSchema.parse(
      await this.request('/ai-stylist/conversations', {
        body: aiStylistConversationCreateInputSchema.parse(input),
        method: 'POST',
      }),
    );
  }

  public async getStylistConversations(
    cursor?: string,
    includeArchived = false,
  ): Promise<AiStylistConversationPage> {
    return aiStylistConversationPageSchema.parse(
      await this.request(
        `/ai-stylist/conversations${queryString({
          cursor,
          includeArchived: includeArchived ? 'true' : 'false',
        })}`,
      ),
    );
  }

  public async getStylistConversation(id: string): Promise<AiStylistConversationDetail> {
    return aiStylistConversationDetailSchema.parse(
      await this.request(`/ai-stylist/conversations/${encodeURIComponent(id)}`),
    );
  }

  public async setStylistConversationArchived(
    id: string,
    archived: boolean,
  ): Promise<AiStylistConversationDetail> {
    return aiStylistConversationDetailSchema.parse(
      await this.request(`/ai-stylist/conversations/${encodeURIComponent(id)}/archive`, {
        body: { archived },
        method: 'PATCH',
      }),
    );
  }

  public async deleteStylistConversation(id: string): Promise<void> {
    await this.request(`/ai-stylist/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  public async sendStylistMessage(
    conversationId: string,
    input: AiStylistMessageInput,
    signal?: AbortSignal,
  ): Promise<AiStylistGenerationResult> {
    return aiStylistGenerationResultSchema.parse(
      await this.request(
        `/ai-stylist/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          body: aiStylistMessageInputSchema.parse(input),
          method: 'POST',
          ...(signal === undefined ? {} : { signal }),
        },
      ),
    );
  }

  public async saveStylistOutfit(input: SaveOutfitInput): Promise<SavedOutfit> {
    return savedOutfitSchema.parse(
      await this.request('/ai-stylist/saved-outfits', {
        body: saveOutfitInputSchema.parse(input),
        method: 'POST',
      }),
    );
  }

  public async getSavedStylistOutfits(cursor?: string): Promise<SavedOutfitPage> {
    return savedOutfitPageSchema.parse(
      await this.request(`/ai-stylist/saved-outfits${queryString({ cursor })}`),
    );
  }

  public async getSavedStylistOutfit(id: string): Promise<SavedOutfit> {
    return savedOutfitSchema.parse(
      await this.request(`/ai-stylist/saved-outfits/${encodeURIComponent(id)}`),
    );
  }

  public async deleteSavedStylistOutfit(id: string): Promise<void> {
    await this.request(`/ai-stylist/saved-outfits/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  public async replaceSavedStylistOutfitItem(
    savedOutfitId: string,
    itemId: string,
    input: ReplaceSavedOutfitItemInput,
  ): Promise<SavedOutfit> {
    return savedOutfitSchema.parse(
      await this.request(
        `/ai-stylist/saved-outfits/${encodeURIComponent(savedOutfitId)}/items/${encodeURIComponent(itemId)}/replacement`,
        {
          body: replaceSavedOutfitItemInputSchema.parse(input),
          method: 'POST',
        },
      ),
    );
  }

  public async recordStylistAttribution(input: AiStylistAttributionInput): Promise<void> {
    await this.request('/ai-stylist/attribution', {
      body: aiStylistAttributionInputSchema.parse(input),
      method: 'POST',
    });
  }

  public async searchListings(query: Partial<ListingSearchQuery>): Promise<ListingPage> {
    return listingPageSchema.parse(
      await this.request(
        `/listings${queryString({
          categoryId: query.categoryId,
          condition: query.condition,
          currency: query.currency,
          cursor: query.cursor,
          limit: query.limit,
          maxPriceMinor: query.maxPriceMinor,
          minPriceMinor: query.minPriceMinor,
          q: query.q,
          size: query.size,
          sort: query.sort,
          colorFamily: query.colorFamily,
          fitType: query.fitType,
          garmentRole: query.garmentRole,
          sizeSystem: query.sizeSystem,
          styleDefinitionIds: query.styleDefinitionIds?.join(','),
        })}`,
      ),
    );
  }

  public async getListing(listingId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(await this.request(`/listings/${listingId}`));
  }

  public async getSimilarListings(listingId: string): Promise<ListingPage> {
    return listingPageSchema.parse(await this.request(`/listings/${listingId}/similar`));
  }

  public async getMyListings(cursor?: string, status?: string): Promise<ListingPage> {
    return listingPageSchema.parse(
      await this.request(`/seller/listings${queryString({ cursor, status })}`),
    );
  }

  public async getMyListing(listingId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(await this.request(`/seller/listings/${listingId}`));
  }

  public async createListing(input: ListingDraftInput): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request('/seller/listings', { body: input, method: 'POST' }),
    );
  }

  public async updateListing(listingId: string, input: ListingUpdateInput): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}`, { body: input, method: 'PATCH' }),
    );
  }

  public async deleteDraft(listingId: string): Promise<void> {
    await this.request(`/seller/listings/${listingId}`, { method: 'DELETE' });
  }

  public async submitListing(listingId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}/submit`, { method: 'POST' }),
    );
  }

  public async archiveListing(listingId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}/archive`, { method: 'POST' }),
    );
  }

  public async uploadListingImage(listingId: string, form: FormData): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}/images`, { body: form, method: 'POST' }),
    );
  }

  public async removeListingImage(listingId: string, imageId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}/images/${imageId}`, { method: 'DELETE' }),
    );
  }

  public async reorderListingImages(
    listingId: string,
    imageIds: readonly string[],
  ): Promise<ListingDetail> {
    return listingDetailSchema.parse(
      await this.request(`/seller/listings/${listingId}/images`, {
        body: { imageIds },
        method: 'PATCH',
      }),
    );
  }

  public async setLike(listingId: string, active: boolean): Promise<SocialActionResult> {
    return socialActionResultSchema.parse(
      await this.request(`/listings/${listingId}/like`, { method: active ? 'PUT' : 'DELETE' }),
    );
  }

  public async setSaved(listingId: string, active: boolean): Promise<SocialActionResult> {
    return socialActionResultSchema.parse(
      await this.request(`/listings/${listingId}/save`, { method: active ? 'PUT' : 'DELETE' }),
    );
  }

  public async getSavedListings(cursor?: string): Promise<ListingPage> {
    return listingPageSchema.parse(
      await this.request(`/me/saved-listings${queryString({ cursor })}`),
    );
  }

  public async setFollow(userId: string, active: boolean): Promise<SocialActionResult> {
    return socialActionResultSchema.parse(
      await this.request(`/sellers/${userId}/follow`, { method: active ? 'PUT' : 'DELETE' }),
    );
  }

  public async getSeller(username: string, cursor?: string): Promise<SellerProfileWithListings> {
    return sellerProfileWithListingsSchema.parse(
      await this.request(`/sellers/${encodeURIComponent(username)}${queryString({ cursor })}`),
    );
  }

  public async reportListing(input: ListingReportInput): Promise<ModerationReport> {
    return moderationReportSchema.parse(
      await this.request('/reports/listings', { body: input, method: 'POST' }),
    );
  }

  public async reportUser(input: UserReportInput): Promise<ModerationReport> {
    return moderationReportSchema.parse(
      await this.request('/reports/users', { body: input, method: 'POST' }),
    );
  }

  public async startConversation(listingId: string): Promise<ConversationDetail> {
    return conversationDetailSchema.parse(
      await this.request('/conversations', { body: { listingId }, method: 'POST' }),
    );
  }
  public async getConversations(): Promise<ConversationPage> {
    return conversationPageSchema.parse(await this.request('/conversations')) as ConversationPage;
  }
  public async getConversation(id: string): Promise<ConversationDetail> {
    return conversationDetailSchema.parse(await this.request(`/conversations/${id}`));
  }
  public async getMessages(id: string, cursor?: string): Promise<MessagePage> {
    return messagePageSchema.parse(
      await this.request(`/conversations/${id}/messages${queryString({ cursor })}`),
    );
  }
  public async sendMessage(id: string, body: string): Promise<Message> {
    return messageSchema.parse(
      await this.request(`/conversations/${id}/messages`, { body: { body }, method: 'POST' }),
    );
  }
  public async markConversationRead(id: string): Promise<void> {
    await this.request(`/conversations/${id}/read`, { method: 'PATCH' });
  }
  public async getAddresses(): Promise<readonly Address[]> {
    return addressSchema.array().parse(await this.request('/addresses'));
  }
  public async createAddress(input: AddressInput): Promise<Address> {
    return addressSchema.parse(
      await this.request('/addresses', { body: addressInputSchema.parse(input), method: 'POST' }),
    );
  }
  public async placeOrder(input: CheckoutInput): Promise<OrderDetail> {
    return orderDetailSchema.parse(await this.request('/orders', { body: input, method: 'POST' }));
  }
  public async getPurchases(cursor?: string): Promise<OrderPage> {
    return orderPageSchema.parse(await this.request(`/orders/purchases${queryString({ cursor })}`));
  }
  public async getSales(cursor?: string): Promise<OrderPage> {
    return orderPageSchema.parse(await this.request(`/orders/sales${queryString({ cursor })}`));
  }
  public async getOrder(id: string): Promise<OrderDetail> {
    return orderDetailSchema.parse(await this.request(`/orders/${id}`));
  }
  public async confirmOrder(id: string): Promise<OrderDetail> {
    return orderDetailSchema.parse(
      await this.request(`/orders/${id}/confirm`, { method: 'PATCH' }),
    );
  }
  public async cancelOrder(
    id: string,
    role: 'buyer' | 'seller',
    reason: string,
  ): Promise<OrderDetail> {
    return orderDetailSchema.parse(
      await this.request(`/orders/${id}/cancel-${role}`, { body: { reason }, method: 'PATCH' }),
    );
  }
  public async shipOrder(id: string, input: ShipmentInput): Promise<OrderDetail> {
    return orderDetailSchema.parse(
      await this.request(`/orders/${id}/shipment`, { body: input, method: 'POST' }),
    );
  }
  public async confirmDelivery(id: string): Promise<OrderDetail> {
    return orderDetailSchema.parse(
      await this.request(`/orders/${id}/confirm-delivery`, { method: 'PATCH' }),
    );
  }
  public async getNotifications(): Promise<NotificationPage> {
    return notificationPageSchema.parse(await this.request('/notifications'));
  }
  public async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/read-all', { method: 'PATCH' });
  }
  public async registerPushDevice(input: PushDeviceInput): Promise<PushDevice> {
    return pushDeviceSchema.parse(
      await this.request('/push-devices', { body: input, method: 'POST' }),
    );
  }

  public async deactivatePushDevice(deviceId: string): Promise<void> {
    await this.request(`/push-devices/${deviceId}`, { method: 'DELETE' });
  }

  public async getReviewEligibility(orderId: string): Promise<ReviewEligibility> {
    return reviewEligibilitySchema.parse(
      await this.request(`/reviews/orders/${orderId}/eligibility`),
    );
  }
  public async createReview(input: ReviewCreateInput): Promise<Review> {
    return reviewSchema.parse(await this.request('/reviews', { body: input, method: 'POST' }));
  }
  public async getUserReviews(
    username: string,
    direction: 'BUYER_TO_SELLER' | 'SELLER_TO_BUYER' = 'BUYER_TO_SELLER',
  ): Promise<ReviewPage> {
    return reviewPageSchema.parse(
      await this.request(
        `/users/${encodeURIComponent(username)}/reviews${queryString({ direction })}`,
      ),
    );
  }
  public async reportReview(id: string, input: ReviewReportInput): Promise<ReviewReport> {
    return reviewReportSchema.parse(
      await this.request(`/reviews/${id}/reports`, { body: input, method: 'POST' }),
    );
  }
  public async getCurrentPolicies(): Promise<CurrentPolicyPage> {
    return currentPolicyPageSchema.parse(await this.request('/policies/current'));
  }
  public async acceptPolicies(policyVersionIds: readonly string[]): Promise<CurrentPolicyPage> {
    return currentPolicyPageSchema.parse(
      await this.request('/policies/accept', {
        body: { policyVersionIds },
        method: 'POST',
      }),
    );
  }
  public async blockUser(userId: string): Promise<UserBlock> {
    return userBlockSchema.parse(await this.request(`/blocks/${userId}`, { method: 'POST' }));
  }
  public async unblockUser(userId: string): Promise<void> {
    await this.request(`/blocks/${userId}`, { method: 'DELETE' });
  }
  public async getBlockedUsers(): Promise<readonly UserBlock[]> {
    return blockPageSchema.parse(await this.request('/blocks')).items;
  }
  public async getSafetyStatus(): Promise<SafetyStatus> {
    return safetyStatusSchema.parse(await this.request('/safety/me'));
  }
  public async getDisputes(): Promise<DisputePage> {
    return disputePageSchema.parse(await this.request('/disputes'));
  }
  public async getDispute(id: string): Promise<DisputeDetail> {
    return disputeDetailSchema.parse(await this.request(`/disputes/${id}`));
  }
  public async createDispute(input: DisputeCreateInput): Promise<DisputeDetail> {
    return disputeDetailSchema.parse(
      await this.request('/disputes', { body: input, method: 'POST' }),
    );
  }
  public async uploadDisputeEvidence(id: string, form: FormData): Promise<DisputeEvidence> {
    return disputeEvidenceSchema.parse(
      await this.request(`/disputes/${id}/evidence`, { body: form, method: 'POST' }),
    );
  }
  public async getSellerVerificationEligibility(): Promise<SellerVerificationEligibility> {
    return sellerVerificationEligibilitySchema.parse(
      await this.request('/seller-verification/eligibility'),
    );
  }
  public async getCurrentSellerVerification(): Promise<SellerVerification | null> {
    const result = await this.request('/seller-verification/current');
    return result === null ? null : sellerVerificationSchema.parse(result);
  }
  public async applyForSellerVerification(statement: string): Promise<SellerVerification> {
    return sellerVerificationSchema.parse(
      await this.request('/seller-verification/apply', {
        body: { statement },
        method: 'POST',
      }),
    );
  }

  private async request(
    path: string,
    options: RequestOptions = {},
    mayRefresh = true,
  ): Promise<unknown> {
    const authenticated = options.authenticated ?? true;
    const accessToken = authenticated ? await this.sessionProvider.getAccessToken() : null;
    if (authenticated && accessToken === null) {
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }

    const headers = new Headers({ Accept: 'application/json' });
    const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
    if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...(options.body === undefined
        ? {}
        : { body: multipart ? (options.body as FormData) : JSON.stringify(options.body) }),
      headers,
      method: options.method ?? 'GET',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }

    const error = await decodeApiError(response);
    if (authenticated && refreshableCodes.has(error.code) && !mayRefresh) {
      this.sessionProvider.sessionBecameInvalid();
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }
    if (authenticated && mayRefresh && refreshableCodes.has(error.code)) {
      try {
        const refreshedToken = await this.sessionProvider.refreshAccessToken();
        if (refreshedToken !== null) {
          return this.request(path, options, false);
        }
      } catch {
        // Refresh failure is handled as a local sign-out below.
      }
      this.sessionProvider.sessionBecameInvalid();
      throw new MobileApiError('AUTH_REQUIRED', 'Authentication is required.', 401);
    }
    throw error;
  }
}
