// Pure what-if maths for the cost forecast (no React, no I/O).
//
// Input is `report.cost.forecast`:
//   { requests_per_day, avg_input_tokens, avg_output_tokens, cost_per_request,
//     current_model, prices: {model: {input, output}}, semester_end, days_to_semester_end }
// Prices are USD per 1M tokens.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const DEFAULT_WHAT_IF = { requestMultiplier: 1, inputMultiplier: 1, model: null };

/** Models offered in the what-if dropdown: current model first, then the priced ones. */
export function forecastModels(forecast) {
  if (!forecast) return [];
  const models = [];
  if (forecast.current_model) models.push(forecast.current_model);
  Object.keys(forecast.prices || {}).forEach((m) => {
    if (!models.includes(m)) models.push(m);
  });
  return models;
}

/** True when `model` has a usable price in the forecast's price table. */
export function hasPrice(forecast, model) {
  const price = forecast?.prices?.[model];
  return Boolean(price) && isNum(price.input) && isNum(price.output);
}

/**
 * Cost of one request under the what-if, or null when it cannot be priced.
 * Uses the price table; falls back to the observed `cost_per_request` only for
 * the current model with unchanged input size (that figure already reflects it).
 */
export function costPerRequest(forecast, { inputMultiplier = 1, model } = {}) {
  if (!forecast) return null;
  const chosen = model || forecast.current_model;
  if (hasPrice(forecast, chosen) && isNum(forecast.avg_input_tokens) && isNum(forecast.avg_output_tokens)) {
    const price = forecast.prices[chosen];
    return (
      forecast.avg_input_tokens * inputMultiplier * price.input
      + forecast.avg_output_tokens * price.output
    ) / 1e6;
  }
  if (chosen === forecast.current_model && inputMultiplier === 1 && isNum(forecast.cost_per_request)) {
    return forecast.cost_per_request;
  }
  return null;
}

/**
 * @param forecast  report.cost.forecast (may be null)
 * @param whatIf    {requestMultiplier, inputMultiplier, model}
 * @returns null when the model has no price (UI: "Chưa có giá cho model này"),
 *   else {model, source, costPerRequest, requestsPerDay, perDay, perWeek, per30Days,
 *         daysToSemesterEnd, restOfSemester}
 */
export function computeForecast(forecast, whatIf = {}) {
  if (!forecast) return null;
  const requestMultiplier = whatIf.requestMultiplier ?? 1;
  const inputMultiplier = whatIf.inputMultiplier ?? 1;
  if (!isNum(requestMultiplier) || requestMultiplier < 0) return null;
  if (!isNum(inputMultiplier) || inputMultiplier < 0) return null;
  const model = whatIf.model || forecast.current_model || null;

  const perRequest = costPerRequest(forecast, { inputMultiplier, model });
  if (perRequest === null) return null;

  const requestsPerDay = (isNum(forecast.requests_per_day) ? forecast.requests_per_day : 0) * requestMultiplier;
  const perDay = perRequest * requestsPerDay;
  const days = isNum(forecast.days_to_semester_end) ? forecast.days_to_semester_end : null;

  return {
    model,
    source: hasPrice(forecast, model) ? 'price' : 'observed',
    costPerRequest: perRequest,
    requestsPerDay,
    perDay,
    perWeek: perDay * 7,
    per30Days: perDay * 30,
    daysToSemesterEnd: days,
    restOfSemester: days === null ? null : perDay * days,
  };
}
