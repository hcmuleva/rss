export type KaryakariniVersion = {
  id: number;
  name: string;
  start_year?: number | null;
  end_year?: number | null;
  is_current?: boolean;
  is_active?: boolean;
};

export type KaryakariniNode = {
  id: number;
  name: string;
  level: string;
  parent_id?: number | null;
  version_id?: number;
  member_count?: number;
  child_count?: number;
  can_assign_member?: boolean;
};

export type KaryakariniMember = {
  id: number;
  user_id?: number | null;
  user_role?: string | null;
  first_name?: string | null;
  father_name?: string | null;
  mobile_number?: string | null;
  avatar?: string | null;
  pad?: string | null;
  period?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  category?: string | null;
  subcategory?: string | null;
  categories?: string[] | null;
  subcategories?: string[] | null;
  state?: string | null;
  district?: string | null;
  tehsil?: string | null;
  address_village?: string | null;
  pincode?: string | null;
  gotra?: string | null;
  village?: string | null;
  node_id: number;
  node_name?: string;
  node_level?: string;
  hierarchy_path?: string;
};

export type KaryakariniPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type KaryakariniAssignableUser = {
  id: number;
  first_name?: string | null;
  father_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gotra?: string | null;
  village?: string | null;
  avatar?: string | null;
};

export type KaryakariniAssignableNode = {
  id: number;
  name: string;
  level: string;
  parent_id?: number | null;
  version_id?: number;
  hierarchy_path?: string;
};

export type KaryakariniGuestMember = {
  id: number;
  node_id: number;
  version_id: number;
  name: string;
  mobile?: string | null;
  email?: string | null;
};

export type KaryakariniAttachment = {
  url: string;
  type?: string | null;
  name?: string | null;
};

export type KaryakariniMeeting = {
  id: number;
  title: string;
  description?: string | null;
  meeting_date: string;
  node_id: number;
  node_name?: string;
  node_level?: string;
  hierarchy_path?: string;
  attendee_count?: number;
  invited_count?: number;
  attachment_count?: number;
  created_by?: number | null;
  created_by_name?: string;
};

export type KaryakariniMeetingAttendee = {
  id: number;
  attendee_type: 'member' | 'guest' | string;
  user_id?: number | null;
  guest_member_id?: number | null;
  attendance_status?: string | null;
  first_name?: string | null;
  father_name?: string | null;
  mobile_number?: string | null;
  email?: string | null;
  avatar?: string | null;
  node_level?: string | null;
  node_name?: string | null;
};

export type KaryakariniMeetingDetails = KaryakariniMeeting & {
  attendees: KaryakariniMeetingAttendee[];
  attachments: KaryakariniAttachment[];
  invites?: KaryakariniMeetingInvite[];
  attendeeUserIds?: number[];
  guestIds?: number[];
  invitedUserIds?: number[];
};

export type KaryakariniMeetingInvite = {
  id: number;
  meeting_id: number;
  version_id: number;
  invited_user_id: number;
  invited_node_id?: number | null;
  invitation_status: 'pending' | 'accepted' | 'rejected' | 'tentative' | string;
  response_note?: string | null;
  responded_at?: string | null;
  notification_read_at?: string | null;
  invited_by?: number | null;
  invited_at?: string | null;
  invited_first_name?: string | null;
  invited_father_name?: string | null;
  invited_mobile?: string | null;
  invited_email?: string | null;
  invited_node_name?: string | null;
  invited_node_level?: string | null;
  meeting_title?: string | null;
  meeting_description?: string | null;
  meeting_date?: string | null;
  meeting_node_name?: string | null;
  meeting_node_level?: string | null;
  invited_by_name?: string | null;
};

export type KaryakariniInvitation = KaryakariniMeetingInvite;

export type KaryakariniSentInvitationSummary = {
  meeting_id: number;
  title: string;
  meeting_date: string;
  node_id: number;
  node_name?: string | null;
  node_level?: string | null;
  hierarchy_path?: string | null;
  invited_count: number;
  accepted_count: number;
  tentative_count: number;
  rejected_count: number;
  pending_count: number;
};

export type KaryakariniMyTeam = {
  id: number;
  user_id: number;
  pad?: string | null;
  period?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  category?: string | null;
  subcategory?: string | null;
  categories?: string[] | null;
  subcategories?: string[] | null;
  node_id: number;
  node_name?: string | null;
  node_level?: string | null;
  hierarchy_path?: string | null;
};

export type KaryakariniCategoryTeamMember = {
  fullName: string;
  mobileNumber: string;
  profilePhotoUrl?: string | null;
};

export type KaryakariniCategoryTeam = {
  id: number;
  version_id: number;
  node_id: number;
  node_name?: string | null;
  node_level?: string | null;
  hierarchy_path?: string | null;
  category: string;
  subcategory?: string | null;
  created_by: number;
  created_by_name?: string | null;
  created_by_avatar?: string | null;
  team_members: KaryakariniCategoryTeamMember[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type KaryakariniTask = {
  id: number;
  title: string;
  description?: string | null;
  task_date: string;
  due_date?: string | null;
  status?: string;
  hierarchy_l1?: string | null;
  hierarchy_l2?: string | null;
  hierarchy_l3?: string | null;
  hierarchy_l4?: string | null;
  hierarchy_l5?: string | null;
  hierarchy_l5_sublevels?: string[] | null;
  task_categories?: string[] | null;
  task_subcategories?: string[] | null;
  node_id: number;
  node_name?: string;
  node_level?: string;
  hierarchy_path?: string;
  assigned_user_id?: number | null;
  assigned_first_name?: string | null;
  assigned_father_name?: string | null;
  attachment_count?: number;
  created_by_name?: string;
};

export type KaryakariniCategoryActivity = {
  id: number;
  version_id: number;
  node_id: number;
  node_name?: string | null;
  node_level?: string | null;
  hierarchy_path?: string | null;
  submitted_by: number;
  submitted_by_name?: string | null;
  submitted_by_avatar?: string | null;
  category?: string | null;
  subcategory: string;
  title: string;
  description?: string | null;
  attachments?: KaryakariniAttachment[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KaryakariniNotificationItem = {
  id: number;
  source: 'task_notification' | 'invitation' | string;
  category: 'tasks' | 'invitations' | string;
  type: string;
  title: string;
  message?: string | null;
  status?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  metadata?: Record<string, any> | null;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string | null;
};
