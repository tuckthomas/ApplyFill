const DATABASE_NAME = 'applyfill-local';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'documents';

export const LOCAL_DATA_KEYS = {
  dashboard: 'dashboard',
  jobApplications: 'job-applications',
  profile: 'profile',
  resumes: 'resumes'
} as const;

export type LocalDataKey = typeof LOCAL_DATA_KEYS[keyof typeof LOCAL_DATA_KEYS];

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) {
      request.result.createObjectStore(DOCUMENT_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Local storage could not be opened.'));
  request.onblocked = () => reject(new Error('Local storage is blocked by another ApplyFill tab.'));
});

const completeTransaction = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('The local storage transaction failed.'));
  transaction.onabort = () => reject(transaction.error ?? new Error('The local storage transaction was cancelled.'));
});

export const readLocalDocument = async <Value>(key: LocalDataKey): Promise<Value | null> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly');
    const request = transaction.objectStore(DOCUMENT_STORE).get(key);
    const value = await new Promise<Value | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Value | undefined);
      request.onerror = () => reject(request.error ?? new Error('Local data could not be read.'));
    });
    await completeTransaction(transaction);
    return value ?? null;
  } finally {
    database.close();
  }
};

export const writeLocalDocument = async <Value>(key: LocalDataKey, value: Value): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).put(value, key);
    await completeTransaction(transaction);
  } finally {
    database.close();
  }
  window.dispatchEvent(new CustomEvent(`applyfill:${key}-changed`));
};

export const deleteLocalDocument = async (key: LocalDataKey): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).delete(key);
    await completeTransaction(transaction);
  } finally {
    database.close();
  }
  window.dispatchEvent(new CustomEvent(`applyfill:${key}-changed`));
};

export const clearApplyFillLocalData = async (): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).clear();
    await completeTransaction(transaction);
  } finally {
    database.close();
  }
  Object.values(LOCAL_DATA_KEYS).forEach((key) => {
    window.dispatchEvent(new CustomEvent(`applyfill:${key}-changed`));
  });
};

export const subscribeToLocalDocument = (key: LocalDataKey, listener: () => void) => {
  const eventName = `applyfill:${key}-changed`;
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};
