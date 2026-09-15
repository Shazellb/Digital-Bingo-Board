import { describe, expect, it } from 'vitest';
import { announcementParts } from './audio';

describe('announcementParts', () => {
  it.each([
    [7, ['Bee', '7']],
    [22, ['Eye', '22']],
    [37, ['En', '37']],
    [52, ['Gee', '52']],
    [68, ['Oh', '68']],
  ] as const)('speaks ball %i as a separate letter and number', (ball, expected) => {
    expect(announcementParts(ball)).toEqual(expected);
  });
});
