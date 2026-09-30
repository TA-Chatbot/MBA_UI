import { describe, it, expect } from 'vitest';
import {
  computeForecast,
  costPerRequest,
  forecastModels,
} from '../../components/performance/forecast';

const base = {
  requests_per_day: 150,
  avg_input_tokens: 2000,
  avg_output_tokens: 500,
  cost_per_request: 0.0004,
  current_model: 'gpt-6-luna',
  prices: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  },
  semester_end: '2026-12-31',
  days_to_semester_end: 92,
};

describe('forecast.costPerRequest', () => {
  it('prices a request from the price table', () => {
    // (2000 * 0.15 + 500 * 0.6) / 1e6 = 0.0006
    expect(costPerRequest(base, { model: 'gpt-4o-mini' })).toBeCloseTo(0.0006, 10);
  });

  it('scales only the input tokens by inputMultiplier', () => {
    // (2000 * 2 * 0.15 + 500 * 0.6) / 1e6 = 0.0009
    expect(costPerRequest(base, { model: 'gpt-4o-mini', inputMultiplier: 2 })).toBeCloseTo(0.0009, 10);
  });

  it('falls back to observed cost_per_request for the unpriced current model', () => {
    expect(costPerRequest(base, { model: 'gpt-6-luna', inputMultiplier: 1 })).toBe(0.0004);
    expect(costPerRequest(base, {})).toBe(0.0004);
  });

  it('prefers the price table for the current model when it has a price', () => {
    const f = { ...base, current_model: 'gpt-4.1-nano' };
    // (2000 * 0.1 + 500 * 0.4) / 1e6 = 0.0004 via prices, not the observed figure
    expect(costPerRequest({ ...f, cost_per_request: 99 }, { model: 'gpt-4.1-nano' })).toBeCloseTo(0.0004, 10);
  });

  it('returns null for an unpriced current model when input size changes', () => {
    expect(costPerRequest(base, { model: 'gpt-6-luna', inputMultiplier: 1.5 })).toBeNull();
  });

  it('returns null for an unpriced model that is not current', () => {
    expect(costPerRequest(base, { model: 'some-other-model' })).toBeNull();
  });

  it('returns null when the fallback figure itself is missing', () => {
    expect(costPerRequest({ ...base, cost_per_request: null }, { model: 'gpt-6-luna' })).toBeNull();
  });
});

describe('forecast.computeForecast', () => {
  it('projects per day, week, 30 days and rest of semester', () => {
    const r = computeForecast(base, { requestMultiplier: 1, inputMultiplier: 1, model: 'gpt-4o-mini' });
    expect(r.source).toBe('price');
    expect(r.requestsPerDay).toBe(150);
    expect(r.perDay).toBeCloseTo(0.09, 10);
    expect(r.perWeek).toBeCloseTo(0.63, 10);
    expect(r.per30Days).toBeCloseTo(2.7, 10);
    expect(r.restOfSemester).toBeCloseTo(0.09 * 92, 10);
    expect(r.daysToSemesterEnd).toBe(92);
  });

  it('multiplies the request volume', () => {
    const r = computeForecast(base, { requestMultiplier: 2, model: 'gpt-4o-mini' });
    expect(r.requestsPerDay).toBe(300);
    expect(r.perDay).toBeCloseTo(0.18, 10);
  });

  it('uses the observed cost for the current model by default', () => {
    const r = computeForecast(base, {});
    expect(r.model).toBe('gpt-6-luna');
    expect(r.source).toBe('observed');
    expect(r.perDay).toBeCloseTo(0.06, 10);
  });

  it('returns null when the chosen model cannot be priced', () => {
    expect(computeForecast(base, { model: 'gpt-6-luna', inputMultiplier: 2 })).toBeNull();
    expect(computeForecast(base, { model: 'unknown-model' })).toBeNull();
  });

  it('leaves rest of semester null when no semester end is set', () => {
    const r = computeForecast({ ...base, semester_end: null, days_to_semester_end: null }, { model: 'gpt-4o-mini' });
    expect(r.restOfSemester).toBeNull();
    expect(r.perDay).toBeCloseTo(0.09, 10);
  });

  it('handles a null forecast and invalid multipliers', () => {
    expect(computeForecast(null, {})).toBeNull();
    expect(computeForecast(base, { requestMultiplier: -1, model: 'gpt-4o-mini' })).toBeNull();
    expect(computeForecast(base, { inputMultiplier: Number.NaN, model: 'gpt-4o-mini' })).toBeNull();
  });

  it('treats a missing requests_per_day as zero volume', () => {
    const r = computeForecast({ ...base, requests_per_day: null }, { model: 'gpt-4o-mini' });
    expect(r.perDay).toBe(0);
  });
});

describe('forecast.forecastModels', () => {
  it('lists the current model then the priced models, without duplicates', () => {
    expect(forecastModels(base)).toEqual(['gpt-6-luna', 'gpt-4o-mini', 'gpt-4.1-nano']);
    expect(forecastModels({ ...base, current_model: 'gpt-4o-mini' })).toEqual(['gpt-4o-mini', 'gpt-4.1-nano']);
  });

  it('copes with a missing forecast or price table', () => {
    expect(forecastModels(null)).toEqual([]);
    expect(forecastModels({ current_model: null, prices: null })).toEqual([]);
  });
});
