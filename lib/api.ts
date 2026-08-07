import axios from 'axios';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7020';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = token;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      const code = error.response?.data?.code;
      const message =
        error.response?.data?.message ||
        (code === 'SESSION_REPLACED'
          ? 'You were signed out because your account signed in on another device.'
          : 'Please sign in again.');
      localStorage.removeItem('adminToken');
      if (!window.location.pathname.includes('/admin/login')) {
        const q = new URLSearchParams({ reason: message });
        window.location.href = `/admin/login?${q.toString()}`;
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  checkSession: async () => {
    const { data } = await api.post('/auth/check-session');
    return data;
  }
};

export type UsersListParams = {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  label?: string;
  role?: string;
  banned?: string;
  proxy?: string;
  cookie?: string;
  openDat?: string;
};

export const usersApi = {
  getAll: async (params?: UsersListParams) => {
    const query: Record<string, string | number> = {};
    if (params?.page != null) query.page = params.page;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.search) query.search = params.search;
    if (params?.plan) query.plan = params.plan;
    if (params?.label) query.label = params.label;
    if (params?.role) query.role = params.role;
    if (params?.banned) query.banned = params.banned;
    if (params?.proxy) query.proxy = params.proxy;
    if (params?.cookie) query.cookie = params.cookie;
    if (params?.openDat) query.openDat = params.openDat;
    const { data } = await api.get('/user', { params: query });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/user', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/user/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(`/user/${id}`);
    return data;
  }
};

export type PartnerSwiftCookieOption = {
  _id: string;
  fileName: string;
  sessionName?: string | null;
  sessionId?: string | null;
  label?: string | null;
  note?: string;
  hasCookies: boolean;
  ready: boolean;
  isActiveSwiftSolutions?: boolean;
};

export type PartnerSwiftDashboardConfig = {
  message?: string;
  manualSelectionEnabled: boolean;
  selectedCookieIds: string[];
  selectedAccounts: PartnerSwiftCookieOption[];
  validSelectedCount: number;
  staleSelectedCount: number;
  staleRemoved: Array<{
    id: string;
    reason: string;
    sessionName?: string | null;
    fileName?: string;
    replacementId?: string;
  }>;
  selectionPruned: boolean;
  slotLimit: number;
  availableCookies: PartnerSwiftCookieOption[];
  previewAccountCount: number;
  previewAccounts: Array<{
    slot: number;
    displayName: string;
    isActive: boolean;
    ready: boolean;
  }>;
};

export const cookiesApi = {
  getAll: async () => {
    const { data } = await api.get('/cookie');
    return data;
  },
  upload: async (file: File, note = '') => {
    const form = new FormData();
    form.append('file', file);
    if (note) form.append('note', note);
    const { data } = await api.post('/cookie/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
  activate: async (id: string, channel: string) => {
    const { data } = await api.post(`/cookie/${id}/activate`, { channel });
    return data;
  },
  deactivate: async (id: string, channel: string) => {
    const { data } = await api.post(`/cookie/${id}/deactivate`, { channel });
    return data;
  },
  setWorking: async (id: string, isWorking: boolean) => {
    const { data } = await api.patch(`/cookie/${id}/working`, { isWorking });
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(`/cookie/${id}`);
    return data;
  },
  getPartnerSwiftDashboardConfig: async () => {
    const { data } = await api.get('/cookie/partner-swift/dashboard-config');
    return data as PartnerSwiftDashboardConfig;
  },
  updatePartnerSwiftDashboardConfig: async (payload: {
    manualSelectionEnabled?: boolean;
    selectedCookieIds?: string[];
  }) => {
    const { data } = await api.put('/cookie/partner-swift/dashboard-config', payload);
    return data as PartnerSwiftDashboardConfig;
  }
};

export const proxiesApi = {
  getAll: async () => {
    const { data } = await api.get('/proxy');
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/proxy', payload);
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/proxy/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(`/proxy/${id}`);
    return data;
  },
  updateSettings: async (payload: {
    globalProxyEnabled?: boolean;
    globalProxyId?: string | null;
  }) => {
    const { data } = await api.put('/proxy/settings', payload);
    return data;
  }
};

export type ManagedExtension = {
  _id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  fileName?: string;
  originalFileName?: string;
  fileSize?: number;
  enabled: boolean;
  extensionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const extensionsApi = {
  list: async () => {
    const { data } = await api.get('/extension');
    return data as { success: boolean; data: ManagedExtension[] };
  },
  upload: async (
    file: File,
    meta: {
      name?: string;
      slug?: string;
      version?: string;
      description?: string;
      enabled?: boolean;
    } = {}
  ) => {
    const form = new FormData();
    form.append('file', file);
    if (meta.name) form.append('name', meta.name);
    if (meta.slug) form.append('slug', meta.slug);
    if (meta.version) form.append('version', meta.version);
    if (meta.description) form.append('description', meta.description);
    if (meta.enabled !== undefined) form.append('enabled', String(meta.enabled));
    const { data } = await api.post('/extension/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/extension/${id}`, payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(`/extension/${id}`);
    return data;
  }
};

export type AppUpdateConfig = {
  app: string;
  updatesEnabled: boolean;
};

export const updatesApi = {
  getConfig: async () => {
    const { data } = await api.get('/update/config');
    return data as { success: boolean; data: AppUpdateConfig[] };
  },
  setConfig: async (app: string, updatesEnabled: boolean) => {
    const { data } = await api.put(`/update/config/${app}`, { updatesEnabled });
    return data as { success: boolean; data: AppUpdateConfig };
  }
};

export type FreightdeskContainerSession = {
  container: string;
  cookieCount?: number;
  remoteCookieCount?: number;
  localCookieCount?: number;
  lastUpdated?: string | null;
  imported?: boolean;
  ready?: boolean;
  cookieId?: string | null;
  fileName?: string;
  label?: string;
  isActiveSingle?: boolean;
  isActiveDouble?: boolean;
  isActiveMulti?: boolean;
  isActiveSwiftSolutions?: boolean;
  isActiveTest?: boolean;
  isActive?: boolean;
  isWorking?: boolean;
};

export type FreightdeskStatus = {
  configured: boolean;
  apiUrl: string;
};

export type CookieChannel = 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test';

export type AssignableCookieLabel =
  | 'new'
  | 'single'
  | 'double'
  | 'multi_without_auto'
  | 'multi_with_auto'
  | 'test';

export const COOKIE_LABEL_OPTIONS: { value: AssignableCookieLabel; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'multi_without_auto', label: 'Multi (without auto)' },
  { value: 'multi_with_auto', label: 'Multi (with Auto)' },
  { value: 'test', label: 'Test' }
];

export const USER_LABEL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'swiftSolutions', label: 'Swift Solutions' },
  { value: 'test', label: 'Test' }
] as const;

export const freightdeskApi = {
  getStatus: async () => {
    const { data } = await api.get('/freightdesk/status');
    return data as FreightdeskStatus;
  },
  getSessions: async () => {
    const { data } = await api.get('/freightdesk/sessions');
    return data as { success: boolean; sessions: FreightdeskContainerSession[]; count?: number };
  },
  importContainer: async (
    container: string,
    options?: { activate?: boolean; channel?: CookieChannel; forceReimport?: boolean }
  ) => {
    const { data } = await api.post(`/freightdesk/import/${encodeURIComponent(container)}`, {
      forceReimport: true,
      ...options
    });
    return data;
  },
  importAll: async (options?: {
    activate?: boolean;
    channel?: CookieChannel;
    forceReimport?: boolean;
  }) => {
    const { data } = await api.post('/freightdesk/import-all', {
      forceReimport: true,
      ...options
    });
    return data;
  },
  activate: async (container: string, channel: CookieChannel = 'single') => {
    const { data } = await api.post(`/freightdesk/activate/${encodeURIComponent(container)}`, {
      channel
    });
    return data;
  },
  updateLabel: async (container: string, label: AssignableCookieLabel) => {
    const { data } = await api.patch(`/freightdesk/label/${encodeURIComponent(container)}`, {
      label
    });
    return data;
  },
  setWorking: async (container: string, isWorking: boolean) => {
    const { data } = await api.patch(`/freightdesk/working/${encodeURIComponent(container)}`, {
      isWorking
    });
    return data;
  }
};
