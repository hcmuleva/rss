export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Team: undefined;
  Admin: undefined;
  Tasks: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  MainTabs: undefined;
  SensitiveDetail: { nodeId?: string | null; assignmentKey?: string } | undefined;
  ActivityForm: { nodeId?: string | null; assignmentKey?: string } | undefined;
  ProjectTask: { nodeId?: string | null; assignmentKey?: string } | undefined;
  AyamDetail: { nodeId?: string | null; assignmentKey?: string } | undefined;
  FullTimeWork: undefined;
  DharmRaksha: undefined;
  MemberDetail: undefined;
  HierarchyBrowser: undefined;
  QRScanner: undefined;
};
