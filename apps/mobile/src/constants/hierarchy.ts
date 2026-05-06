export type HierarchyLevel =
  | 'PRANT'
  | 'SAMBHAG'
  | 'VIBHAG'
  | 'DISTRICT'
  | 'KHAND'
  | 'MANDAL'
  | 'GRAM'
  | 'NAGAR'
  | 'BASTI'
  | 'MOHALLA';

export const HIERARCHY_ORDER: HierarchyLevel[] = [
  'PRANT',
  'SAMBHAG',
  'VIBHAG',
  'DISTRICT',
  'KHAND',
  'MANDAL',
  'GRAM',
  'NAGAR',
  'BASTI',
  'MOHALLA'
];
