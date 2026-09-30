import { describe, it, expect } from 'vitest';
import { buildSettingsBody } from '../../components/performance/SettingsDrawer';

const row = (model, input, output) => ({ id: model, model, input: String(input), output: String(output) });

describe('SettingsDrawer.buildSettingsBody', () => {
  it('builds the PUT body: one pattern per line, prices as numbers, empty date as null', () => {
    const { body, error } = buildSettingsBody({
      excludedText: ' ptit:*\n\nb23dcmr001 \n',
      priceRows: [row('gpt-4o-mini', '0,15', '0.6'), row('gpt-6-luna', '', '')],
      semesterEnd: '',
    });
    expect(error).toBeUndefined();
    expect(body).toEqual({
      excluded_users: ['ptit:*', 'b23dcmr001'],
      prices: { 'gpt-4o-mini': { input: 0.15, output: 0.6 } },
      semester_end: null,
    });
  });

  it('rejects incomplete, negative, duplicate or nameless prices', () => {
    const base = { excludedText: '', semesterEnd: '2026-12-31' };
    expect(buildSettingsBody({ ...base, priceRows: [row('m', '0.1', '')] }).error).toMatch(/cả giá input và output/);
    expect(buildSettingsBody({ ...base, priceRows: [row('m', '-1', '0.2')] }).error).toMatch(/≥ 0/);
    expect(buildSettingsBody({ ...base, priceRows: [row('m', 'abc', '0.2')] }).error).toMatch(/≥ 0/);
    expect(buildSettingsBody({ ...base, priceRows: [row('m', '1', '2'), row('m', '1', '2')] }).error).toMatch(/trùng/);
    expect(buildSettingsBody({ ...base, priceRows: [row('', '1', '2')] }).error).toMatch(/tên model/);
  });

  it('enforces the pattern limits', () => {
    const many = Array.from({ length: 201 }, (_, i) => `u${i}`).join('\n');
    expect(buildSettingsBody({ excludedText: many, priceRows: [], semesterEnd: '' }).error).toMatch(/200/);
    expect(buildSettingsBody({ excludedText: 'x'.repeat(101), priceRows: [], semesterEnd: '' }).error).toMatch(/100 ký tự/);
  });
});
