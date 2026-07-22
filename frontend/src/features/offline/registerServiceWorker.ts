export const registerApplyFillServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('ApplyFill offline support could not be enabled.', error);
    });
  }, { once: true });
};
