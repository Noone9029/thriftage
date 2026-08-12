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
        })}`,
      ),
    );
  }

  public async getListing(listingId: string): Promise<ListingDetail> {
    return listingDetailSchema.parse(await this.request(`/listings/${listingId}`));
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
