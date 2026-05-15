import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../../theme';
import type { KaryakariniMember, KaryakariniNode, KaryakariniPagination } from '../types';

type Props = {
  visible: boolean;
  loading: boolean;
  node: KaryakariniNode | null;
  members: KaryakariniMember[];
  pagination: KaryakariniPagination;
  onClose: () => void;
  onChangePage: (page: number) => void;
  onEditMember?: (member: KaryakariniMember) => void;
};

const initials = (value: string) =>
  String(value || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || '?';

const RowValue = ({ text }: { text?: string | null }) => (
  <Text style={styles.value} numberOfLines={2}>
    {text || '-'}
  </Text>
);

const memberName = (member: KaryakariniMember) =>
  [member.first_name, member.father_name].filter(Boolean).join(' ').trim() || '-';

const memberPeriod = (member: KaryakariniMember) =>
  member.period ||
  [member.start_date || null, member.end_date || null].filter(Boolean).join(' to ') ||
  '-';

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  }
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

export function MemberDialog({ visible, loading, node, members, pagination, onClose, onChangePage, onEditMember }: Props) {
  const canPrev = pagination.page > 1;
  const canNext = pagination.page < (pagination.totalPages || 1);
  const groupedMembers = useMemo(() => {
    const byLocation = new Map<
      string,
      { nodeId: number; locationName: string; path: string; members: KaryakariniMember[] }
    >();

    members.forEach((member) => {
      const nodeId = Number(member.node_id || 0);
      const path = String(member.hierarchy_path || member.node_name || 'Unassigned location').trim() || 'Unassigned location';
      const locationName = String(member.node_name || path.split(' > ').slice(-1)[0] || 'Unassigned location').trim();
      const key = `${nodeId}::${path}`;
      if (!byLocation.has(key)) {
        byLocation.set(key, { nodeId, locationName, path, members: [] });
      }
      byLocation.get(key)?.members.push(member);
    });

    const selectedNodeId = Number(node?.id || 0);
    return [...byLocation.values()]
      .map((location) => {
        const byPad = new Map<string, KaryakariniMember[]>();
        location.members.forEach((member) => {
          const pad = String(member.pad || '').trim() || 'Unassigned pad';
          if (!byPad.has(pad)) byPad.set(pad, []);
          byPad.get(pad)?.push(member);
        });
        const padGroups = [...byPad.entries()]
          .map(([pad, rows]) => ({
            pad,
            rows,
          }))
          .sort((a, b) => a.pad.localeCompare(b.pad));
        return { ...location, padGroups };
      })
      .sort((a, b) => {
        const aSelected = selectedNodeId > 0 && a.nodeId === selectedNodeId;
        const bSelected = selectedNodeId > 0 && b.nodeId === selectedNodeId;
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        const aDepth = (a.path.match(/>/g) || []).length;
        const bDepth = (b.path.match(/>/g) || []).length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.path.localeCompare(b.path);
      });
  }, [members, node?.id]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Members</Text>
              <Text style={styles.subtitle}>{node?.name || 'Selected Node'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator style={styles.groupedWrap}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : groupedMembers.length === 0 ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>No members found</Text>
              </View>
            ) : (
              groupedMembers.map((location) => (
                <View key={`loc-${location.nodeId}-${location.path}`} style={styles.locationSection}>
                  <Text style={styles.locationTitle}>{location.locationName}</Text>
                  <Text style={styles.locationSub}>{location.path}</Text>
                  {location.padGroups.map((padGroup) => (
                    <View key={`pad-${location.nodeId}-${padGroup.pad}`} style={styles.padSection}>
                      <Text style={styles.padTitle}>{padGroup.pad}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
                        <View>
                          <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, styles.colAvatar]}>Avatar</Text>
                            <Text style={[styles.headerCell, styles.colName]}>Name</Text>
                            <Text style={[styles.headerCell, styles.colCategory]}>Categories</Text>
                            <Text style={[styles.headerCell, styles.colSubcategory]}>Subcategories</Text>
                            <Text style={[styles.headerCell, styles.colMobile]}>Mobile</Text>
                            <Text style={[styles.headerCell, styles.colGotra]}>Gotra</Text>
                            <Text style={[styles.headerCell, styles.colVillage]}>Village</Text>
                            <Text style={[styles.headerCell, styles.colPeriod]}>Period</Text>
                            <Text style={[styles.headerCell, styles.colPath]}>Path</Text>
                            <Text style={[styles.headerCell, styles.colAction]}>Action</Text>
                          </View>

                          {padGroup.rows.map((member) => (
                            <View key={`${member.id}-${member.user_id || member.mobile_number || 'member'}`} style={styles.row}>
                              <View style={[styles.cell, styles.colAvatar]}>
                                {member.avatar ? (
                                  <Image source={{ uri: member.avatar }} style={styles.avatar} />
                                ) : (
                                  <View style={styles.avatarFallback}>
                                    <Text style={styles.avatarFallbackText}>{initials(memberName(member))}</Text>
                                  </View>
                                )}
                              </View>
                              <View style={[styles.cell, styles.colName]}>
                                <RowValue text={memberName(member)} />
                              </View>
                              <View style={[styles.cell, styles.colCategory]}>
                                <View style={styles.pillsWrap}>
                                  {parseLabelList(member.categories && member.categories.length ? member.categories : member.category || '').map((entry) => (
                                    <View key={`cat-${member.id}-${entry}`} style={styles.pill}>
                                      <Text style={styles.pillText}>{entry}</Text>
                                    </View>
                                  ))}
                                  {parseLabelList(member.categories && member.categories.length ? member.categories : member.category || '').length === 0 ? (
                                    <Text style={styles.value}>-</Text>
                                  ) : null}
                                </View>
                              </View>
                              <View style={[styles.cell, styles.colSubcategory]}>
                                <View style={styles.pillsWrap}>
                                  {parseLabelList(member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || '').map(
                                    (entry) => (
                                      <View key={`sub-${member.id}-${entry}`} style={styles.pill}>
                                        <Text style={styles.pillText}>{entry}</Text>
                                      </View>
                                    )
                                  )}
                                  {parseLabelList(member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || '').length ===
                                  0 ? (
                                    <Text style={styles.value}>-</Text>
                                  ) : null}
                                </View>
                              </View>
                              <View style={[styles.cell, styles.colMobile]}>
                                <RowValue text={member.mobile_number} />
                              </View>
                              <View style={[styles.cell, styles.colGotra]}>
                                <RowValue text={member.gotra} />
                              </View>
                              <View style={[styles.cell, styles.colVillage]}>
                                <RowValue text={member.village} />
                              </View>
                              <View style={[styles.cell, styles.colPeriod]}>
                                <RowValue text={memberPeriod(member)} />
                              </View>
                              <View style={[styles.cell, styles.colPath]}>
                                <RowValue text={member.hierarchy_path} />
                              </View>
                              <View style={[styles.cell, styles.colAction]}>
                                {onEditMember ? (
                                  <TouchableOpacity style={styles.editBtn} onPress={() => onEditMember(member)}>
                                    <Text style={styles.editBtnText}>Edit</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.pagination}>
            <Text style={styles.pageText}>
              Page {pagination.page} / {Math.max(1, pagination.totalPages || 1)} • Total {pagination.total}
            </Text>
            <View style={styles.pageActions}>
              <TouchableOpacity
                disabled={!canPrev || loading}
                style={[styles.pageBtn, (!canPrev || loading) && styles.pageBtnDisabled]}
                onPress={() => canPrev && onChangePage(pagination.page - 1)}
              >
                <Text style={styles.pageBtnText}>Prev</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!canNext || loading}
                style={[styles.pageBtn, (!canNext || loading) && styles.pageBtnDisabled]}
                onPress={() => canNext && onChangePage(pagination.page + 1)}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    maxHeight: '90%',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  close: {
    fontSize: 22,
    color: theme.colors.text.secondary,
  },
  groupedWrap: {
    maxHeight: '70%',
  },
  locationSection: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  locationSub: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  padSection: {
    gap: 6,
  },
  padTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  value: {
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  colAvatar: {
    width: 74,
  },
  colName: {
    width: 170,
  },
  colFather: {
    width: 180,
  },
  colCategory: {
    width: 200,
  },
  colSubcategory: {
    width: 240,
  },
  colMobile: {
    width: 140,
  },
  colGotra: {
    width: 130,
  },
  colVillage: {
    width: 150,
  },
  colPeriod: {
    width: 170,
  },
  colPath: {
    width: 260,
  },
  colAction: {
    width: 110,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  editBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingWrap: {
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pageText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    color: theme.colors.text.primary,
    fontWeight: '700',
    fontSize: 12,
  },
});
