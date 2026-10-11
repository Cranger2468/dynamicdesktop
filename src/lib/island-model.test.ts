import { describe, expect, it } from 'vitest';
import { canShowEvent, defaultSettings, formatTime } from './island-model';
describe('island event preferences', () => {
  it('blocks all events when the island is disabled', () => { expect(canShowEvent({...defaultSettings, enabled: false}, 'Media')).toBe(false); });
  it('blocks an individually disabled event', () => { expect(canShowEvent({...defaultSettings, events: {...defaultSettings.events, Camera: false}}, 'Camera')).toBe(false); expect(canShowEvent(defaultSettings, 'Camera')).toBe(true); });
  it('formats countdowns without negative values', () => { expect(formatTime(90)).toBe('1:30'); expect(formatTime(-1)).toBe('0:00'); });
});