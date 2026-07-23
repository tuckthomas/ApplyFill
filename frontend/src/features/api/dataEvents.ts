export type DataResource = 'applications' | 'profile' | 'resumes';

const eventName = (resource: DataResource) => `applyfill:data:${resource}`;

export const notifyDataChanged = (resource: DataResource) => {
  window.dispatchEvent(new Event(eventName(resource)));
};

export const subscribeToDataChanged = (resource: DataResource, listener: () => void) => {
  const name = eventName(resource);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
};
