import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ProfileMenu } from '../../core/components/ProfileMenu';
import { useProfile } from '../../core/context/ProfileContext';
import { authClient } from '../../api/client';
import { theme } from '../../theme';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { StandardModal } from '../../core/components/StandardModal';
import { MaterialIcons } from '@expo/vector-icons';

type AnnouncementCategory = {
  category: string;
  label: string;
  count: number;
};

type AnnouncementItem = {
  id: number;
  category: string;
  title: string;
  message: string;
  comment_count: number;
  created_at: string;
  created_by_name?: string;
};

type AnnouncementComment = {
  id: number;
  announcement_id: number;
  comment_text: string;
  created_at: string;
  user_name?: string;
};

const toDateTimeText = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AnnouncementsAdminScreen() {
  const { user, logout } = useProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<AnnouncementCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedCategoryLabel = useMemo(
    () => categories.find((item) => item.category === selectedCategory)?.label || selectedCategory || 'Category',
    [categories, selectedCategory]
  );

  const loadCategories = useCallback(async () => {
    const res = await authClient.get('/announcements/categories');
    const rows = (res?.data?.data?.categories || []) as AnnouncementCategory[];
    setCategories(rows);
    setSelectedCategory((prev) => {
      if (prev && rows.some((row) => row.category === prev)) return prev;
      return rows[0]?.category || '';
    });
  }, []);

  const loadAnnouncements = useCallback(async (category: string) => {
    if (!category) {
      setAnnouncements([]);
      return;
    }
    const res = await authClient.get('/announcements', {
      params: { category, limit: 30, page: 1 },
    });
    const rows = (res?.data?.data?.announcements || []) as AnnouncementItem[];
    setAnnouncements(rows);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await loadCategories();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load announcement categories');
    }
  }, [loadCategories]);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await loadData();
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [loadData]);

  useEffect(() => {
    if (!selectedCategory) return;
    void loadAnnouncements(selectedCategory);
  }, [loadAnnouncements, selectedCategory]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData();
      if (selectedCategory) await loadAnnouncements(selectedCategory);
    } finally {
      setRefreshing(false);
    }
  }, [loadAnnouncements, loadData, selectedCategory]);

  const handleCreate = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!selectedCategory || !trimmedTitle || !trimmedMessage) {
      Alert.alert('Required', 'Please select a category and enter title + message.');
      return;
    }

    try {
      setSubmitting(true);
      await authClient.post('/announcements', {
        category: selectedCategory,
        title: trimmedTitle,
        message: trimmedMessage,
      });
      setTitle('');
      setMessage('');
      await Promise.all([loadCategories(), loadAnnouncements(selectedCategory)]);
      Alert.alert('Success', 'Announcement created and broadcast sent to members.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  }, [loadAnnouncements, loadCategories, message, selectedCategory, title]);

  const handleOpenComments = useCallback(async (announcement: AnnouncementItem) => {
    try {
      setSelectedAnnouncement(announcement);
      setCommentsModalVisible(true);
      setCommentsLoading(true);
      const res = await authClient.get(`/announcements/${announcement.id}/comments`, {
        params: { page: 1, limit: 200 },
      });
      setComments((res?.data?.data?.comments || []) as AnnouncementComment[]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load comments');
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helperText}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Announcements"
        showBack
        onBack={() => router.replace('/admin' as any)}
        user={user}
        onLogout={handleLogout}
      />

      <PageHeaderCard
        title="Announcements"
        subtitle="Broadcast to all members"
        icon={<MaterialIcons name="campaign" size={24} color={theme.colors.primary} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
          style={styles.categoriesWrap}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.category;
            return (
              <TouchableOpacity
                key={category.category}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(category.category)}
              >
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>{category.label}</Text>
                <View style={[styles.countPill, isSelected && styles.countPillActive]}>
                  <Text style={[styles.countPillText, isSelected && styles.countPillTextActive]}>{category.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.composeCard}>
          <Text style={styles.composeTitle}>Create Announcement • {selectedCategoryLabel}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            style={styles.input}
            placeholderTextColor={theme.colors.text.disabled}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            style={[styles.input, styles.messageInput]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor={theme.colors.text.disabled}
          />
          <TouchableOpacity style={[styles.submitButton, submitting && styles.disabledBtn]} onPress={() => void handleCreate()} disabled={submitting}>
            <Text style={styles.submitButtonText}>{submitting ? 'Publishing...' : 'Publish to all members'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listHeading}>Recent in {selectedCategoryLabel}</Text>
          {announcements.length === 0 ? (
            <Text style={styles.helperText}>No announcements in this category yet.</Text>
          ) : (
            announcements.map((item) => (
              <View key={`announcement-${item.id}`} style={styles.announcementCard}>
                <View style={styles.announcementHeader}>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  <TouchableOpacity style={styles.commentBadge} onPress={() => void handleOpenComments(item)}>
                    <Text style={styles.commentBadgeText}>{item.comment_count} comments</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.announcementMessage}>{item.message}</Text>
                <Text style={styles.announcementMeta}>
                  By {item.created_by_name || 'Admin'} • {toDateTimeText(item.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <StandardModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        title="Comments"
        subtitle={selectedAnnouncement?.title || '-'}
      >
        {commentsLoading ? (
          <View style={styles.modalStateWrap}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.helperText}>Loading comments...</Text>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.modalStateWrap}>
            <Text style={styles.helperText}>No comments yet.</Text>
          </View>
        ) : (
          <View style={styles.commentsList}>
            {comments.map((comment) => (
              <View key={`comment-${comment.id}`} style={styles.modalCommentCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.modalCommentAuthor}>{comment.user_name || 'Member'}</Text>
                  <Text style={styles.modalCommentDate}>{toDateTimeText(comment.created_at)}</Text>
                </View>
                <Text style={styles.modalCommentText}>{comment.comment_text}</Text>
              </View>
            ))}
          </View>
        )}
      </StandardModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF9F7',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F7',
  },
  topHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FCEFE6',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  subHeading: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 19,
  },
  categoriesWrap: {
    marginTop: 2,
  },
  categoriesRow: {
    gap: 8,
    paddingRight: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8D9D0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFF1E8',
  },
  categoryChipText: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: theme.colors.primaryDark,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countPillActive: {
    backgroundColor: theme.colors.primary,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  countPillTextActive: {
    color: '#fff',
  },
  composeCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDDCD2',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  composeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  messageInput: {
    minHeight: 110,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listSection: {
    gap: 10,
  },
  listHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  announcementCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDDED5',
    padding: 12,
    gap: 8,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  commentBadge: {
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  commentBadgeText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  announcementMessage: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  announcementMeta: {
    fontSize: 11,
    color: theme.colors.text.disabled,
  },
  helperText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBDACF',
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalSubTitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalCloseText: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  modalStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  commentsList: {
    maxHeight: 420,
  },
  modalCommentCard: {
    borderWidth: 1,
    borderColor: '#EEE1D9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FFFDFC',
  },
  modalCommentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  modalCommentText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text.secondary,
  },
  modalCommentDate: {
    marginTop: 5,
    fontSize: 10,
    color: theme.colors.text.disabled,
  },
});
