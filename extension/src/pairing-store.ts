import type { PairingUpdateRequest, ScopedValue, ValidationResult } from './contracts';
import { PAIRING_PROTOCOL_VERSION, validatePairingUpdate } from './contracts';
import { isApprovedApplyFillOrigin } from './security';

const PAIRING_STORAGE_KEY = 'applyfill.persistent-pairing';

export interface StoredPairing {
  protocolVersion: typeof PAIRING_PROTOCOL_VERSION;
  sourceOrigin: string;
  pairingSecret: string;
  includeSensitive: boolean;
  profileUpdatedAtUtc: string;
  values: ScopedValue[];
}

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export class PairingStore {
  constructor(private readonly storage: StorageArea) {}

  async current(): Promise<StoredPairing | undefined> {
    const stored = (await this.storage.get(PAIRING_STORAGE_KEY))[PAIRING_STORAGE_KEY];
    if (!stored || typeof stored !== 'object') return undefined;
    const pairing = stored as StoredPairing;
    if (Object.keys(pairing).some((key) => ![
      'protocolVersion', 'sourceOrigin', 'pairingSecret', 'includeSensitive', 'profileUpdatedAtUtc', 'values',
    ].includes(key)) || !isApprovedApplyFillOrigin(pairing.sourceOrigin)) return undefined;
    const validation = validatePairingUpdate({
      type: 'applyfill.pair',
      protocolVersion: pairing.protocolVersion,
      pairingSecret: pairing.pairingSecret,
      includeSensitive: pairing.includeSensitive,
      profileUpdatedAtUtc: pairing.profileUpdatedAtUtc,
      values: pairing.values,
    });
    return validation.ok ? structuredClone(pairing) : undefined;
  }

  async pair(request: PairingUpdateRequest, sourceOrigin: string): Promise<StoredPairing> {
    const pairing: StoredPairing = {
      protocolVersion: PAIRING_PROTOCOL_VERSION,
      sourceOrigin,
      pairingSecret: request.pairingSecret,
      includeSensitive: request.includeSensitive,
      profileUpdatedAtUtc: request.profileUpdatedAtUtc,
      values: structuredClone(request.values),
    };
    await this.storage.set({ [PAIRING_STORAGE_KEY]: pairing });
    return structuredClone(pairing);
  }

  async sync(request: PairingUpdateRequest, sourceOrigin: string): Promise<ValidationResult<StoredPairing>> {
    const current = await this.current();
    if (!current || current.sourceOrigin !== sourceOrigin || current.pairingSecret !== request.pairingSecret) {
      return { ok: false, error: 'ApplyFill is not paired with this extension.' };
    }
    return { ok: true, value: await this.pair(request, sourceOrigin) };
  }

  async status(pairingSecret: string, sourceOrigin: string): Promise<ValidationResult<StoredPairing>> {
    const current = await this.current();
    if (!current || current.sourceOrigin !== sourceOrigin || current.pairingSecret !== pairingSecret) {
      return { ok: false, error: 'ApplyFill is not paired with this extension.' };
    }
    return { ok: true, value: current };
  }

  async unpair(pairingSecret: string, sourceOrigin: string): Promise<ValidationResult<true>> {
    const current = await this.current();
    if (!current || current.sourceOrigin !== sourceOrigin || current.pairingSecret !== pairingSecret) {
      return { ok: false, error: 'ApplyFill is not paired with this extension.' };
    }
    await this.storage.remove(PAIRING_STORAGE_KEY);
    return { ok: true, value: true };
  }
}
