import type {
  AdminAuditLogDto, AdminCategoryDto, AdminDashboardDto, AdminEquipmentTypeDto, AdminListingDto, AdminOperationDto,
  AdminReportDto, AdminUserDto, ApiErrorBody, AuthResponse, CategoryDto, ClientContactEvent, ContactDto, EquipmentTypeDto,
  ErrorCode, ListingCardDto, ListingDetailDto, LocalityDto, LocationConfigDto, LocationHistoryDto, MeDto, OperationDto,
  OwnerListingDto, Paginated, PlaceDetailDto, PlaceDto, ReportReason, TempPasswordDto,
} from '@yantramitra/shared-types';
import type {
  ChangePasswordInput, CreateListingInput, LoginInput, RegisterInput, SearchQuery, UpdateListingInput, UpdateLocationInput,
  UpdateProfileInput,
} from '@yantramitra/shared-validation';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RefreshTokenStore {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}

export interface ApiClientOptions {
  /** e.g. "/api/v1" or "https://api.example.com/api/v1" */
  baseUrl: string;
  clientType: 'web' | 'native';
  /** Native only. Web keeps the refresh token in an HttpOnly cookie that scripts cannot read. */
  refreshTokenStore?: RefreshTokenStore;
  /** Called when the session can no longer be refreshed. */
  onSessionLost?: () => void;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | boolean | null | undefined>;
interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  auth?: 'none' | 'required';
  init?: RequestInit & Record<string, unknown>;
}

export function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function createApiClient(options: ApiClientOptions) {
  let accessToken: string | null = null;
  let refreshing: Promise<MeDto | null> | null = null;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function raw<T>(path: string, o: RequestOptions, token: string | null): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${options.baseUrl}${path}${toQueryString(o.query)}`, {
        credentials: options.clientType === 'web' ? 'include' : 'omit',
        ...o.init,
        method: o.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          'X-Client-Type': options.clientType,
          ...(o.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const e = data as ApiErrorBody | null;
      throw new ApiError(res.status, e?.code ?? 'INTERNAL_ERROR', e?.message ?? 'Request failed', e?.details ?? {});
    }
    return data as T;
  }

  async function accept(auth: AuthResponse): Promise<MeDto> {
    accessToken = auth.accessToken;
    if (auth.refreshToken) await options.refreshTokenStore?.set(auth.refreshToken);
    return auth.user;
  }

  async function clear(): Promise<void> {
    accessToken = null;
    await options.refreshTokenStore?.set(null);
  }

  /** Restores the session. Concurrent callers share one refresh request. Returns null when signed out. */
  function refresh(): Promise<MeDto | null> {
    refreshing ??= (async () => {
      try {
        let body: { refreshToken?: string } = {};
        if (options.clientType === 'native') {
          const refreshToken = await options.refreshTokenStore?.get();
          if (!refreshToken) return null;
          body = { refreshToken };
        }
        return await accept(await raw<AuthResponse>('/auth/refresh', { method: 'POST', body }, null));
      } catch (e) {
        // A network failure must not sign a farmer with poor connectivity out.
        if (e instanceof ApiError && e.status === 401) {
          await clear();
          return null;
        }
        throw e;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
    if (o.auth !== 'required') return raw<T>(path, o, null);
    if (!accessToken && !(await refresh())) {
      options.onSessionLost?.();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in');
    }
    try {
      return await raw<T>(path, o, accessToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      if (!(await refresh())) {
        options.onSessionLost?.();
        throw e;
      }
      return raw<T>(path, o, accessToken);
    }
  }

  const get = <T>(path: string, query?: Query, init?: RequestOptions['init']) => request<T>(path, { query, init });
  const authed = <T>(method: string, path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method, body, query, auth: 'required' });

  return {
    auth: {
      register: async (input: RegisterInput) => accept(await raw<AuthResponse>('/auth/register', { method: 'POST', body: input }, null)),
      login: async (input: LoginInput) => accept(await raw<AuthResponse>('/auth/login', { method: 'POST', body: input }, null)),
      logout: async () => {
        const refreshToken = (await options.refreshTokenStore?.get()) ?? undefined;
        try {
          await raw<void>('/auth/logout', { method: 'POST', body: { refreshToken } }, accessToken);
        } finally {
          await clear();
        }
      },
      restore: refresh,
      changePassword: async (input: ChangePasswordInput) => accept(await authed<AuthResponse>('POST', '/auth/change-password', input)),
      me: () => authed<MeDto>('GET', '/auth/me'),
    },
    users: {
      update: (input: UpdateProfileInput) => authed<MeDto>('PATCH', '/users/me', input),
      listings: (query?: Query) => authed<Paginated<OwnerListingDto>>('GET', '/users/me/listings', undefined, query),
      listing: (id: string) => authed<OwnerListingDto>('GET', `/users/me/listings/${id}`),
      locationHistory: (id: string) => authed<LocationHistoryDto[]>('GET', `/users/me/listings/${id}/location-history`),
      favorites: (query?: Query) => authed<Paginated<ListingCardDto>>('GET', '/users/me/favorites', undefined, query),
      favoriteIds: () => authed<string[]>('GET', '/users/me/favorites/ids'),
    },
    catalogue: {
      categories: (init?: RequestOptions['init']) => get<CategoryDto[]>('/categories', undefined, init),
      types: (id: string) => get<EquipmentTypeDto[]>(`/categories/${id}/types`),
      operations: (init?: RequestOptions['init']) => get<OperationDto[]>('/operations', undefined, init),
    },
    equipment: {
      search: (query: SearchQuery, init?: RequestOptions['init']) => get<Paginated<ListingCardDto>>('/equipment', query as Query, init),
      nearby: (query: SearchQuery & { lat: number; lng: number }) => get<Paginated<ListingCardDto>>('/equipment/nearby', query as Query),
      get: (id: string, init?: RequestOptions['init']) => get<ListingDetailDto>(`/equipment/${id}`, undefined, init),
      create: (input: CreateListingInput) => authed<OwnerListingDto>('POST', '/equipment', input),
      update: (id: string, input: UpdateListingInput) => authed<OwnerListingDto>('PATCH', `/equipment/${id}`, input),
      remove: (id: string) => authed<void>('DELETE', `/equipment/${id}`),
      setStatus: (id: string, status: 'active' | 'inactive' | 'unavailable') => authed<OwnerListingDto>('PATCH', `/equipment/${id}/status`, { status }),
      updateLocation: (id: string, input: UpdateLocationInput) => authed<OwnerListingDto>('PATCH', `/equipment/${id}/location`, input),
      addFavorite: (id: string) => authed<void>('POST', `/equipment/${id}/favorite`),
      removeFavorite: (id: string) => authed<void>('DELETE', `/equipment/${id}/favorite`),
      contact: (id: string) => authed<ContactDto>('GET', `/equipment/${id}/contact`),
      contactEvent: (id: string, type: ClientContactEvent) => authed<void>('POST', `/equipment/${id}/contact-events`, { type }),
      report: (id: string, input: { reason: ReportReason; details?: string | null }) => authed<{ id: string }>('POST', `/equipment/${id}/reports`, input),
    },
    locations: {
      config: () => get<LocationConfigDto>('/locations/config'),
      search: (q: string, limit = 8) => get<PlaceDto[]>('/locations/search', { q, limit }),
      reverse: (lat: number, lng: number) => get<PlaceDto | null>('/locations/reverse', { lat, lng }),
      place: (slug: string, init?: RequestOptions['init']) => get<PlaceDetailDto>(`/locations/places/${encodeURIComponent(slug)}`, undefined, init),
      localities: (init?: RequestOptions['init']) => get<LocalityDto[]>('/locations/localities', undefined, init),
    },
    admin: {
      dashboard: () => authed<AdminDashboardDto>('GET', '/admin/dashboard'),
      listings: (query?: Query) => authed<Paginated<AdminListingDto>>('GET', '/admin/listings', undefined, query),
      setListingStatus: (id: string, body: { status: 'suspended' | 'active' | 'inactive'; reason?: string | null }) =>
        authed<void>('PATCH', `/admin/listings/${id}/status`, body),
      users: (query?: Query) => authed<Paginated<AdminUserDto>>('GET', '/admin/users', undefined, query),
      setUserStatus: (id: string, body: { status: 'active' | 'suspended'; reason?: string | null }) =>
        authed<void>('PATCH', `/admin/users/${id}/status`, body),
      resetPassword: (id: string) => authed<TempPasswordDto>('POST', `/admin/users/${id}/password-reset`),
      reports: (query?: Query) => authed<Paginated<AdminReportDto>>('GET', '/admin/reports', undefined, query),
      updateReport: (id: string, body: { status: 'reviewing' | 'resolved' | 'dismissed'; resolutionNote?: string | null }) =>
        authed<void>('PATCH', `/admin/reports/${id}`, body),
      categories: () => authed<AdminCategoryDto[]>('GET', '/admin/categories'),
      equipmentTypes: () => authed<AdminEquipmentTypeDto[]>('GET', '/admin/equipment-types'),
      operations: () => authed<AdminOperationDto[]>('GET', '/admin/operations'),
      saveCatalogue: (kind: 'categories' | 'equipment-types' | 'operations', id: string | null, body: unknown) =>
        authed<unknown>(id ? 'PATCH' : 'POST', `/admin/${kind}${id ? `/${id}` : ''}`, body),
      auditLogs: (query?: Query) => authed<Paginated<AdminAuditLogDto>>('GET', '/admin/audit-logs', undefined, query),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
