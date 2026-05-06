export interface HierarchyNode {
  id: string;
  name_hi: string;
  name_en: string;
  level: string;
  branch: 'rural' | 'urban';
  parentId: string | null;
  address: string;
  addressDetails?: {
    villageOrMohalla: string;
    tehsil: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  lat: number;
  long: number;
}

export interface VanshavaliNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  photo?: string;
  name: string;
  dates: {
    from?: string;
    till?: string;
  };
  religion: string;
  caste: string;
  gotra: string;
}

export const hierarchyNodes: HierarchyNode[] = [
  {
    id: 'h-l1-1',
    name_hi: 'मालवा प्रांत',
    name_en: 'Malwa Prant',
    level: 'PRANT',
    branch: 'rural',
    parentId: null,
    address: 'Madhya Pradesh',
    lat: 23.1765,
    long: 75.7885
  },
  {
    id: 'h-l2-1',
    name_hi: 'उज्जैन संभाग',
    name_en: 'Ujjain Sambhag',
    level: 'SAMBHAG',
    branch: 'rural',
    parentId: 'h-l1-1',
    address: 'Ujjain',
    lat: 23.1765,
    long: 75.7885
  },
  {
    id: 'h-l3-1',
    name_hi: 'सेवा विभाग',
    name_en: 'Seva Vibhag',
    level: 'VIBHAG',
    branch: 'rural',
    parentId: 'h-l2-1',
    address: 'Ujjain Region',
    lat: 23.1765,
    long: 75.7885
  },
  {
    id: 'h-l4-1',
    name_hi: 'इंदौर जिला',
    name_en: 'Indore District',
    level: 'DISTRICT',
    branch: 'rural',
    parentId: 'h-l3-1',
    address: 'Indore',
    lat: 22.7196,
    long: 75.8577
  },
  {
    id: 'h-l5a1-1',
    name_hi: 'देपालपुर खंड',
    name_en: 'Depalpur Khand',
    level: 'KHAND',
    branch: 'rural',
    parentId: 'h-l4-1',
    address: 'Depalpur',
    lat: 22.8501,
    long: 75.5422
  },
  {
    id: 'h-l5a2-1',
    name_hi: 'सांवेर मंडल',
    name_en: 'Sanwer Mandal',
    level: 'MANDAL',
    branch: 'rural',
    parentId: 'h-l5a1-1',
    address: 'Sanwer',
    lat: 22.9734,
    long: 75.8278
  },
  {
    id: 'h-l5a3-1',
    name_hi: 'बिछोली ग्राम',
    name_en: 'Bicholi Gram',
    level: 'GRAM',
    branch: 'rural',
    parentId: 'h-l5a2-1',
    address: 'Bicholi',
    lat: 22.6983,
    long: 75.9054
  },
  {
    id: 'h-l5b1-1',
    name_hi: 'इंदौर नगर',
    name_en: 'Indore Nagar',
    level: 'NAGAR',
    branch: 'urban',
    parentId: 'h-l4-1',
    address: 'Indore City',
    lat: 22.7196,
    long: 75.8577
  },
  {
    id: 'h-l5b2-1',
    name_hi: 'राजवाड़ा बस्ती',
    name_en: 'Rajwada Basti',
    level: 'BASTI',
    branch: 'urban',
    parentId: 'h-l5b1-1',
    address: 'Rajwada',
    lat: 22.7178,
    long: 75.8545
  },
  {
    id: 'h-l5b3-1',
    name_hi: 'नंदलालपुरा मोहल्ला',
    name_en: 'Nandlalpura Mohalla',
    level: 'MOHALLA',
    branch: 'urban',
    parentId: 'h-l5b2-1',
    address: 'Nandlalpura',
    lat: 22.7128,
    long: 75.8477
  }
];

export const vanshavaliNodes: VanshavaliNode[] = [
  {
    id: 'v-1',
    parentId: null,
    childrenIds: ['v-2'],
    name: 'Raghunath Ji',
    dates: { from: '1950-01-01' },
    religion: 'Hindu',
    caste: 'Rajput',
    gotra: 'Kashyap'
  },
  {
    id: 'v-2',
    parentId: 'v-1',
    childrenIds: [],
    name: 'Mohan Ji',
    dates: { from: '1980-01-01' },
    religion: 'Hindu',
    caste: 'Rajput',
    gotra: 'Kashyap'
  }
];
