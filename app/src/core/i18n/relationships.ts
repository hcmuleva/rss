export type RelationshipKey =
  | 'self'
  | 'head'
  | 'spouse'
  | 'son'
  | 'daughter'
  | 'father'
  | 'mother'
  | 'brother'
  | 'sister'
  | 'grandfather'
  | 'grandmother'
  | 'grandson'
  | 'granddaughter'
  | 'uncle'
  | 'aunt'
  | 'nephew'
  | 'niece'
  | 'cousin'
  | 'sonInLaw'
  | 'daughterInLaw'
  | 'parentInLaw'
  | 'sibling'
  | 'siblingInLaw'
  | 'child';

export interface RelationshipOption {
  key: RelationshipKey;
  backendValue: string;
}

export const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { key: 'spouse', backendValue: 'spouse' },
  { key: 'son', backendValue: 'son' },
  { key: 'daughter', backendValue: 'daughter' },
  { key: 'father', backendValue: 'father' },
  { key: 'mother', backendValue: 'mother' },
  { key: 'brother', backendValue: 'brother' },
  { key: 'sister', backendValue: 'sister' },
  { key: 'grandfather', backendValue: 'grandfather' },
  { key: 'grandmother', backendValue: 'grandmother' },
  { key: 'grandson', backendValue: 'grandson' },
  { key: 'granddaughter', backendValue: 'granddaughter' }
];

const RELATIONSHIP_NORMALIZATION: Record<string, RelationshipKey> = {
  self: 'self',
  head: 'head',
  spouse: 'spouse',
  husband: 'spouse',
  wife: 'spouse',
  son: 'son',
  daughter: 'daughter',
  father: 'father',
  mother: 'mother',
  brother: 'brother',
  sister: 'sister',
  grandfather: 'grandfather',
  grandmother: 'grandmother',
  grandson: 'grandson',
  granddaughter: 'granddaughter',
  uncle: 'uncle',
  aunt: 'aunt',
  nephew: 'nephew',
  niece: 'niece',
  cousin: 'cousin',
  'son-in-law': 'sonInLaw',
  soninlaw: 'sonInLaw',
  son_in_law: 'sonInLaw',
  'daughter-in-law': 'daughterInLaw',
  daughterinlaw: 'daughterInLaw',
  daughter_in_law: 'daughterInLaw',
  'parent-in-law': 'parentInLaw',
  parentinlaw: 'parentInLaw',
  parent_in_law: 'parentInLaw',
  sibling: 'sibling',
  'sibling-in-law': 'siblingInLaw',
  siblinginlaw: 'siblingInLaw',
  sibling_in_law: 'siblingInLaw',
  child: 'child'
};

export const getRelationshipKey = (
  relationship: string | undefined | null,
  fallbackGender?: string
): RelationshipKey => {
  const normalized = String(relationship || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (normalized && RELATIONSHIP_NORMALIZATION[normalized]) {
    return RELATIONSHIP_NORMALIZATION[normalized];
  }

  if (normalized === 'parent') {
    return String(fallbackGender || '').toUpperCase() === 'F' ? 'mother' : 'father';
  }

  if (!normalized) {
    return 'child';
  }

  return 'child';
};
