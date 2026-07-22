import { useEffect, useState } from 'react';
import {
  attachPairedAutofillSuggestions,
  createScopedAutofillValues,
  inspectPairedAutofillApplication,
} from '../features/autofill/extensionHandoff';
import { createLocalAiAutofillProposals } from '../features/autofill/localAutofillMapper';
import { hasCompleteCachedModel, loadDeployedModelManifest, localAiRuntime } from '../features/local-ai';
import { loadProfileDocument } from '../features/profile/profileBuilder';

export default function AutofillAssist() {
  const [status, setStatus] = useState('Preparing private AI suggestions for the job application…');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const extensionId = query.get('extensionId') ?? '';
        const targetTabId = Number(query.get('targetTabId'));
        if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) throw new Error('The job application tab could not be identified.');
        const profile = await loadProfileDocument();
        if (!profile?.isComplete) throw new Error('Complete My Profile before using job application autofill.');

        const fields = await inspectPairedAutofillApplication(extensionId, targetTabId);
        const values = createScopedAutofillValues(profile, false);
        if (localAiRuntime.snapshot.state !== 'ready') {
          setStatus('Starting Local AI on this computer…');
          const manifest = await loadDeployedModelManifest(controller.signal);
          const model = manifest.models.find((entry) => entry.approvedTasks.includes('autofill-field-mapping'))
            ?? manifest.models.find((entry) => entry.id === manifest.defaultModelId);
          if (!model) throw new Error('No approved Local AI model is available for job application matching.');
          if (!await hasCompleteCachedModel(model)) {
            setStatus('Local AI has not been set up yet. Recognized fields are still ready in the extension. You can set up Local AI in ApplyFill Settings for harder questions.');
            window.setTimeout(() => window.close(), 2_000);
            return;
          }
          await localAiRuntime.initialize({
            acceleratorPreference: 'automatic',
            model,
            signal: controller.signal,
            onProgress: (progress) => setStatus(progress.message),
          });
        }

        setStatus('Matching your profile to this application with Local AI…');
        const suggestions = await createLocalAiAutofillProposals({
          runtime: localAiRuntime,
          profile,
          fields,
          values,
          signal: controller.signal,
        });
        await attachPairedAutofillSuggestions(
          extensionId,
          targetTabId,
          suggestions.generatedValues,
          suggestions.proposals,
        );
        setStatus('Suggestions are ready in the extension. This helper tab will close automatically.');
        window.setTimeout(() => window.close(), 800);
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus(error instanceof Error ? error.message : 'Local AI suggestions could not be prepared. You can still review the recognized fields in the extension.');
        }
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <main className="autofill-assist-page">
      <section className="surface-panel page-stack" aria-labelledby="autofill-assist-title">
        <h1 className="section-title" id="autofill-assist-title">Preparing Job Application Suggestions</h1>
        <p className="section-copy">ApplyFill is matching this application with your locally saved profile. Your information stays on this computer.</p>
        <p className="field-hint" role="status" aria-live="polite">{status}</p>
      </section>
    </main>
  );
}
