import { describe, expect, it } from 'vitest';
import { decimalsOf, escapeHtml, formatEuro, formatNumber, formatPercent, formatSignedEuro, parseFrenchNumber, plainSpaces } from '../../src/tools/shared/numbers.ts';

describe('nombres à la française', () => {
  it.each([
    ['200 000', 200_000],
    ['200000', 200_000],
    ['200 000', 200_000],
    ['1 200,50 €', 1200.5],
    ['3,5', 3.5],
    ['3.5', 3.5],
    ['3,5 %', 3.5],
    ['1.200.000', 1_200_000],
    ['1.200,50', 1200.5],
    ['−120', -120],
    ['0', 0],
  ])('lit « %s »', (input, expected) => {
    expect(parseFrenchNumber(input)).toBe(expected);
  });

  it.each(['', 'abc', '3,5,2', '12a', '-', '1e5'])('refuse « %s »', (input) => {
    expect(parseFrenchNumber(input)).toBeNull();
  });

  it('formate avec les espaces typographiques français', () => {
    expect(formatNumber(1159.916, 2)).toBe('1 159,92');
    expect(formatEuro(200_000)).toBe('200 000 €');
    expect(formatPercent(5.5555)).toBe('5,56 %');
    expect(plainSpaces(formatSignedEuro(-108.846, 2))).toBe('−108,85 €');
    expect(plainSpaces(formatSignedEuro(15))).toBe('+15 €');
    expect(formatNumber(-0.001, 2)).toBe('0,00');
  });

  it('compte les décimales et échappe le HTML', () => {
    expect(decimalsOf(3.25)).toBe(2);
    expect(decimalsOf(200)).toBe(0);
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
