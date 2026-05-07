import User from '@/database/user';
import { AsyncLocalStorage } from 'async_hooks';

interface IRequestContext {
  user: User
}

class RequestContext {
  private asyncLocalStorage: AsyncLocalStorage<IRequestContext>;

  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage();
  }

  run<T>(context: IRequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  get<K extends keyof IRequestContext>(key: K): IRequestContext[K] | undefined {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Request context is not set');
    }
    return store[key];
  }

  set<K extends keyof IRequestContext>(key: K, value: IRequestContext[K]): void {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Request context is not set');
    }
    store[key] = value;
  }

  getAll(): IRequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  currentUserId(): string {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Request context is not set');
    }

    return store.user.id;
  }

  currentUser(): User {
    const store = this.asyncLocalStorage.getStore();
    if (!store) {
      throw new Error('Request context is not set');
    }
    return store.user;
  }
}

const requestContext = new RequestContext()

export { requestContext }