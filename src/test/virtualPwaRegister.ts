interface RegisterSWOptions {
  immediate?: boolean;
  onNeedReload?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

let registeredOptions: RegisterSWOptions | undefined;

export function registerSW(options: RegisterSWOptions = {}): () => Promise<void> {
  registeredOptions = options;
  return async () => {};
}

export function getRegisteredOptions(): RegisterSWOptions | undefined {
  return registeredOptions;
}

export function resetRegisteredOptions(): void {
  registeredOptions = undefined;
}
