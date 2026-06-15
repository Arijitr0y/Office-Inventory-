type GoogleSheetError = { message: string } | null;
type QueryFilter = { column: string; value: unknown };
type QueryOrder = { column: string; ascending: boolean } | null;
type AuthListener = (_event: string, session: GoogleSheetSession | null) => void;

type GoogleSheetUser = {
  id: string;
  email: string;
};

type GoogleSheetSession = {
  user: GoogleSheetUser;
};

type ApiPayload = {
  action: string;
  token?: string;
  table?: string;
  filters?: QueryFilter[];
  order?: QueryOrder;
  values?: unknown;
  onConflict?: string;
  single?: boolean;
  maybeSingle?: boolean;
  userId?: string;
  email?: string;
  password?: string;
  mode?: 'sign-in' | 'sign-up';
  fn?: string;
  params?: Record<string, unknown>;
  bucket?: string;
  path?: string;
  filename?: string;
  mimeType?: string;
  dataUrl?: string;
};

type ApiResponse<T = any> = {
  data?: T;
  error?: GoogleSheetError;
};

const googleScriptUrl = (import.meta.env.VITE_GOOGLE_SCRIPT_URL || '').trim();
const googleScriptToken = (import.meta.env.VITE_GOOGLE_SCRIPT_TOKEN || '').trim();
const SESSION_KEY = 'velostock_google_sheet_session';
const UPLOAD_URL_CACHE_KEY = 'velostock_google_sheet_upload_urls';

// Keep the old export name so the existing screens do not need a full rewrite.
export const isSupabaseConfigured =
  googleScriptUrl !== '' &&
  !googleScriptUrl.includes('YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL');

const authListeners = new Set<AuthListener>();

const readStoredSession = (): GoogleSheetSession | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as GoogleSheetSession) : null;
  } catch {
    return null;
  }
};

const storeSession = (session: GoogleSheetSession | null) => {
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }

  authListeners.forEach((listener) => listener(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
};

const getCurrentUserId = () => readStoredSession()?.user.id;

const makeError = (message: string): ApiResponse<any> => ({
  data: null,
  error: { message },
});

const requestGoogleSheetPost = async <T = any>(payload: ApiPayload): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return makeError(`Google Sheet request failed with HTTP ${response.status}.`);
    }

    const text = await response.text();
    const json = JSON.parse(text) as ApiResponse<T>;

    return json.error
      ? { data: json.data, error: json.error }
      : { data: json.data as T, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Google Sheet request error.';

    return makeError(message);
  }
};

const requestGoogleSheetJsonp = async <T = any>(
  payload: ApiPayload,
): Promise<ApiResponse<T>> => {
  return new Promise((resolve) => {
    const callbackName = `__velostockGs_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const script = document.createElement('script');

    const cleanup = () => {
      delete (window as any)[callbackName];
      script.remove();
      window.clearTimeout(timeoutId);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(
        makeError(
          'Google Sheet request timed out. Check Apps Script deployment access and URL.',
        ),
      );
    }, 30000);

    (window as any)[callbackName] = (json: ApiResponse<T>) => {
      cleanup();

      resolve(
        json.error
          ? { data: json.data, error: json.error }
          : { data: json.data as T, error: null },
      );
    };

    try {
      const url = new URL(googleScriptUrl);

      url.searchParams.set('payload', JSON.stringify(payload));
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('_', String(Date.now()));

      script.async = true;
      script.src = url.toString();

      script.onerror = () => {
        cleanup();
        resolve(
          makeError(
            'Failed to load Google Apps Script. Use the /exec Web App URL and deploy access as Anyone.',
          ),
        );
      };

      document.body.appendChild(script);
    } catch (err) {
      cleanup();

      const message =
        err instanceof Error ? err.message : 'Invalid Google Apps Script URL.';

      resolve(makeError(message));
    }
  });
};

const requestGoogleSheet = async <T = any>(
  payload: ApiPayload,
): Promise<ApiResponse<T>> => {
  if (!isSupabaseConfigured) {
    return {
      data: undefined,
      error: { message: 'Google Apps Script URL is not configured.' },
    };
  }

  const payloadWithAuth: ApiPayload = {
    ...payload,
    token: googleScriptToken || undefined,
    userId: payload.userId ?? getCurrentUserId(),
  };

  // Normal auth/database calls use JSONP to avoid Apps Script CORS failure.
  // Large image uploads still use POST because image data cannot safely fit in URL.
  if (payloadWithAuth.action === 'upload') {
    return requestGoogleSheetPost<T>(payloadWithAuth);
  }

  return requestGoogleSheetJsonp<T>(payloadWithAuth);
};
class GoogleSheetQueryBuilder {
  private readonly table: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private filters: QueryFilter[] = [];
  private orderBy: QueryOrder = null;
  private values: unknown;
  private onConflict?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*') {
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(values: unknown) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.values = values;
    this.onConflict = options?.onConflict;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  single() {
    return this.execute(true, false);
  }

  maybeSingle() {
    return this.execute(false, true);
  }

  then<TResult1 = ApiResponse<any>, TResult2 = never>(
    onfulfilled?: ((value: ApiResponse<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute(false, false).then(onfulfilled, onrejected);
  }

  private execute(single: boolean, maybeSingle: boolean) {
    return requestGoogleSheet({
      action: this.operation,
      table: this.table,
      filters: this.filters,
      order: this.orderBy,
      values: this.values,
      onConflict: this.onConflict,
      single,
      maybeSingle,
    });
  }
}

const readUploadCache = (): Record<string, string> => {
  try {
    const raw = window.localStorage.getItem(UPLOAD_URL_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeUploadCache = (cache: Record<string, string>) => {
  window.localStorage.setItem(UPLOAD_URL_CACHE_KEY, JSON.stringify(cache));
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read selected image.'));
    reader.readAsDataURL(file);
  });

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: readStoredSession() }, error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },

    async signUp({ email, password }: { email: string; password: string }) {
      const result = await requestGoogleSheet<GoogleSheetSession>({
        action: 'auth',
        mode: 'sign-up',
        email,
        password,
      });

      if (!result.error && result.data) {
        storeSession(result.data);
      }

      return result;
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await requestGoogleSheet<GoogleSheetSession>({
        action: 'auth',
        mode: 'sign-in',
        email,
        password,
      });

      if (!result.error && result.data) {
        storeSession(result.data);
      }

      return result;
    },

    async signOut() {
      storeSession(null);
      return { error: null };
    },
  },

  from(table: string) {
    return new GoogleSheetQueryBuilder(table);
  },

  rpc(fn: string, params: Record<string, unknown>) {
    return requestGoogleSheet({ action: 'rpc', fn, params });
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, _options?: unknown) {
          void _options;
          const dataUrl = await fileToDataUrl(file);
          const result = await requestGoogleSheet<{ publicUrl: string }>({
            action: 'upload',
            bucket,
            path,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataUrl,
          });

          if (!result.error && result.data?.publicUrl) {
            const cache = readUploadCache();
            cache[path] = result.data.publicUrl;
            writeUploadCache(cache);
          }

          return result;
        },

        getPublicUrl(path: string) {
          const cache = readUploadCache();
          return { data: { publicUrl: cache[path] || '' } };
        },
      };
    },
  },
};
