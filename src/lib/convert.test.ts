import { describe, it, expect } from 'vitest';
import { convert } from './convert';

describe('convert', () => {
  it('converts temperature', () => expect(convert('100 C in F')).toBe('212 °F'));
  it('converts distance', () => expect(convert('1 mi in km')).toBe('1.609 km'));
  it('converts time zones', () => expect(convert('12pm UTC in Tokyo', new Date('2026-01-15T00:00:00Z'))).toBe('9:00 PM in Tokyo'));
  it('returns null for nonsense', () => expect(convert('hello')).toBeNull());
});
