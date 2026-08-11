import {
  adminAccessSchema,
  adminListingDetailSchema,
  adminListingQueueSchema,
  categorySchema,
  moderationReportPageSchema,
  moderationReportSchema,
  type AdminListingDetail,
  type AdminListingQueueItem,
  type Category,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ListingStatus,
  type ModerationReport,
  type ModerationReportStatus,
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
