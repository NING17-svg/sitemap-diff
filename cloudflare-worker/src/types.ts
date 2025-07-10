// 环境变量接口定义
export interface Env {
  RSS_STORAGE: DurableObjectNamespace;
  SITEMAP_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_TARGET_CHAT: string;
}

// 定义 Cloudflare Workers 类型
declare global {
  // Cloudflare Workers 特定类型
  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    idFromString(id: string): DurableObjectId;
    get(id: DurableObjectId): DurableObject;
  }

  interface DurableObjectId {
    toString(): string;
  }

  interface DurableObject {
    fetch(url: string | Request, init?: RequestInit): Promise<Response>;
  }

  interface DurableObjectState {
    storage: DurableObjectStorage;
  }

  interface DurableObjectStorage {
    get<T = any>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T = any>(options?: { prefix?: string; limit?: number; reverse?: boolean; }): Promise<Map<string, T>>;
  }

  interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<string | null>;
    put(key: string, value: string | ReadableStream | ArrayBuffer | FormData, options?: { expiration?: number; expirationTtl?: number; }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number }[]; list_complete: boolean; cursor?: string }>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }

  interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
  }
} 