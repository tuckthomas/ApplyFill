import { describe, expect, it } from 'vitest';
import { PAIRING_PROTOCOL_VERSION, type PairingUpdateRequest } from '../src/contracts';
import { PairingStore } from '../src/pairing-store';

class MemoryStorage {
  values: Record<string, unknown> = {};
  async get(key: string) { return { [key]: this.values[key] }; }
  async set(items: Record<string, unknown>) { Object.assign(this.values, structuredClone(items)); }
  async remove(key: string) { delete this.values[key]; }
}

const request = (type: PairingUpdateRequest['type'], secret = 'a'.repeat(43)): PairingUpdateRequest => ({
  type,
  protocolVersion: PAIRING_PROTOCOL_VERSION,
  pairingSecret: secret,
  includeSensitive: false,
  profileUpdatedAtUtc: '2030-01-01T00:00:00.000Z',
  values: [{ sourceKey: 'profile.email', semantic: 'email', displayLabel: 'Email', value: 'person@example.test' }],
});

describe('persistent extension pairing', () => {
  it('survives store recreation and accepts authenticated profile updates', async () => {
    const storage = new MemoryStorage();
    await new PairingStore(storage).pair(request('applyfill.pair'), 'https://applyfill.app');
    const restarted = new PairingStore(storage);
    expect(await restarted.status('a'.repeat(43), 'https://applyfill.app')).toMatchObject({ ok: true });
    expect(await restarted.sync(request('applyfill.sync-profile'), 'https://applyfill.app')).toMatchObject({ ok: true });
  });

  it('rejects another origin or secret and deletes the local copy on unpair', async () => {
    const storage = new MemoryStorage();
    const store = new PairingStore(storage);
    await store.pair(request('applyfill.pair'), 'https://applyfill.app');
    expect(await store.sync(request('applyfill.sync-profile', 'b'.repeat(43)), 'https://applyfill.app')).toMatchObject({ ok: false });
    expect(await store.status('a'.repeat(43), 'https://evil.test')).toMatchObject({ ok: false });
    expect(await store.unpair('a'.repeat(43), 'https://applyfill.app')).toEqual({ ok: true, value: true });
    expect(await store.current()).toBeUndefined();
  });

  it('fails closed when extension-local pairing data is malformed', async () => {
    const storage = new MemoryStorage();
    await new PairingStore(storage).pair(request('applyfill.pair'), 'https://applyfill.app');
    const key = Object.keys(storage.values)[0]!;
    storage.values[key] = { ...(storage.values[key] as object), sourceOrigin: 'https://evil.test' };
    expect(await new PairingStore(storage).current()).toBeUndefined();
  });
});
