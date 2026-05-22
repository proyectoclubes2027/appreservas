export const SHIFTS = [
  { start: '10:00', end: '11:30' },
  { start: '11:30', end: '13:00' },
  { start: '13:00', end: '14:30' },
  { start: '14:30', end: '16:00' },
  { start: '16:00', end: '17:30' },
  { start: '17:30', end: '19:00' },
  { start: '19:00', end: '20:00' },
  { start: '20:30', end: '22:00' },
  { start: '22:00', end: '23:30' },
];

export const formatShift = (start: string, end: string) => `${start} - ${end}`;
