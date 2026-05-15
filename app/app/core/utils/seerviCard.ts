import type { User } from '../types';

type CardProfileMeta = {
  maritalStatus?: string | null;
  husbandName?: string | null;
  role?: string | null;
  category?: string | null;
  districtCode?: string | number | null;
};

const normalizeCode = (value: string | number | null | undefined, fallback: string): string => {
  const text = String(value ?? '').replace(/\D/g, '');
  if (!text) return fallback;
  return text.padStart(2, '0').slice(-2);
};

export const buildSeerviCardId = (user: User, meta?: CardProfileMeta): string => {
  if (user.seerviCardId) return user.seerviCardId;
  const countryCode = 'IN';
  const stateCode = 'MP';
  const districtCode = normalizeCode(meta?.districtCode ?? user.districtCode, '00');
  const serial = String(user.id).padStart(4, '0').slice(-4);
  return `${countryCode}-${stateCode}-${districtCode}${serial}`;
};

const titleCase = (value: string): string =>
  value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');

export const buildUserDisplayName = (user: User, meta?: CardProfileMeta): string => {
  const isMarriedWoman =
    String(user.gender || '').toUpperCase() === 'F' &&
    String((meta?.maritalStatus ?? user.maritalStatus) || '').toLowerCase() === 'married';
  const guardianName = isMarriedWoman
    ? meta?.husbandName || user.husbandName || user.fatherName
    : user.fatherName;
  return [user.firstName, guardianName, user.gotra].filter(Boolean).join(' ');
};

export const buildRoleCategoryLabel = (user: User, meta?: CardProfileMeta): string => {
  if (user.roleCategoryLabel) return user.roleCategoryLabel;
  const rawRole = (meta?.role || user.role || 'Member').trim();
  const rawCategory = (meta?.category || '').trim();
  if (rawRole.includes('(') && rawRole.includes(')')) return rawRole;

  if (rawCategory) {
    return `${titleCase(rawRole)} (${titleCase(rawCategory)})`;
  }

  if (rawRole.includes('_')) {
    const parts = rawRole.split('_');
    const role = parts[0] || 'Member';
    const category = parts.slice(1).join(' ');
    return category
      ? `${titleCase(role)} (${titleCase(category)})`
      : titleCase(role);
  }

  return `${titleCase(rawRole)} (General)`;
};

export const buildAttendanceQrPayload = (user: User, cardId: string): string => {
  const payload = {
    type: 'seervi_attendance',
    version: 1,
    userId: user.id,
    cardId,
    issuedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
};
