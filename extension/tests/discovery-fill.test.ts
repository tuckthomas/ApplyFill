import { describe, expect, it, vi } from 'vitest';
import { discoverFields } from '../src/discovery';
import { fillSelections } from '../src/fill';

describe('synthetic job-form discovery', () => {
  it('discovers bounded semantic descriptors without existing values or prohibited controls', () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email address</label><input id="email" name="email" autocomplete="email" value="existing@example.test" required>
        <label for="bio">Experience</label><textarea id="bio"></textarea>
        <label for="country">Country</label><select id="country"><option value="US">United States</option></select>
        <fieldset><legend>Authorized to work?</legend><label><input type="radio" name="auth" value="yes">Yes</label><label><input type="radio" name="auth" value="no">No</label></fieldset>
        <label><input type="checkbox" name="contact">Contact me</label>
        <label for="resume">Resume</label><input id="resume" type="file">
        <label for="password">Password</label><input id="password" type="password" value="do-not-collect">
        <label for="card">Credit card number</label><input id="card" value="4111111111111111">
        <div role="combobox" contenteditable="true" aria-label="Custom picker"></div>
      </form>`;
    const { fields } = discoverFields();
    expect(fields.map((field) => field.control)).toEqual(expect.arrayContaining(['input', 'textarea', 'select', 'radio-group', 'checkbox', 'unsupported']));
    expect(fields.filter((field) => field.control === 'radio-group')).toHaveLength(1);
    expect(JSON.stringify(fields)).not.toMatch(/existing@example|do-not-collect|411111/);
    expect(fields.find((field) => field.inputType === 'file')?.unsupportedReason).toMatch(/manual/i);
  });
});

describe('browser-like controlled filling', () => {
  it('dispatches framework events and reports values rewritten by the site', async () => {
    document.body.innerHTML = `<label for="name">Name</label><input id="name"><label for="city">City</label><input id="city">`;
    const { fields, registry } = discoverFields();
    const name = document.getElementById('name') as HTMLInputElement;
    const city = document.getElementById('city') as HTMLInputElement;
    const nameInput = vi.fn();
    const nameChange = vi.fn();
    name.addEventListener('input', nameInput);
    name.addEventListener('change', nameChange);
    city.addEventListener('input', () => { city.value = 'site-rewrite'; });
    const labels = new Map(fields.map((field) => [field.id, field.label]));
    const byLabel = new Map(fields.map((field) => [field.label, field.id]));
    const report = await fillSelections([
      { fieldId: byLabel.get('Name')!, value: 'Ada Lovelace', selected: true, classification: 'deterministic' },
      { fieldId: byLabel.get('City')!, value: 'London', selected: true, classification: 'deterministic' },
    ], registry, labels);
    expect(name.value).toBe('Ada Lovelace');
    expect(nameInput).toHaveBeenCalledOnce();
    expect(nameChange).toHaveBeenCalledOnce();
    expect(report.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Name', status: 'filled' }),
      expect.objectContaining({ label: 'City', status: 'changed-by-site' }),
    ]));
  });

  it('requires a fresh explicit scan after a client-side form step', () => {
    document.body.innerHTML = `<label for="one">Step one</label><input id="one">`;
    const first = discoverFields();
    document.body.innerHTML = `<label for="two">Step two</label><input id="two">`;
    expect([...first.registry.values()][0] instanceof Element && !([...first.registry.values()][0] as Element).isConnected).toBe(true);
    expect(discoverFields().fields[0]?.label).toBe('Step two');
  });
});
