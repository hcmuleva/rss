import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { getActivities } from '@/api/activities.api';
import { getAssignments } from '@/api/assignments.api';
import { getAyamEntries } from '@/api/ayam.api';
import { getDharmRakshaEntries } from '@/api/dharmRaksha.api';
import { getFullTimeTasks } from '@/api/fulltime.api';
import { getHierarchyNodes } from '@/api/hierarchy.api';
import { getProjectTasks } from '@/api/projects.api';
import { getSensitiveEntries } from '@/api/sensitive.api';
import { FlatListCard } from '@/components/FlatListCard';
import { Colors } from '@/constants/colors';
import { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';

const defaultCards = [
  { id: '1', titleHi: 'प्रालेखन', titleEn: 'Pralekhan', area: 'उज्जैन नगर / Ujjain Nagar', level: 'L5', icon: 'book-outline' as const },
  { id: '2', titleHi: 'धर्म रक्षा समिति', titleEn: 'Dharm Raksha Samiti', area: 'Assigned Area', level: 'L5', icon: 'shield-checkmark-outline' as const }
];

export const HomeScreen = (): React.JSX.Element => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const role = useAuthStore((state) => state.role);
  const assignedNodeId = useAuthStore((state) => state.assignedNodeId);
  const isFullTime = useAuthStore((state) => state.isFullTime);
  const isUser = role === 'USER';
  const { data: sensitiveEntries = [] } = useQuery({ queryKey: ['sensitive-entries'], queryFn: getSensitiveEntries, enabled: isUser });
  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: getActivities, enabled: isUser });
  const { data: dharmRaksha = [] } = useQuery({ queryKey: ['dharm-raksha'], queryFn: getDharmRakshaEntries, enabled: isUser });
  const { data: fulltimeTasks = [] } = useQuery({ queryKey: ['fulltime-tasks'], queryFn: getFullTimeTasks, enabled: isUser && isFullTime });
  const { data: assignments = [] } = useQuery({ queryKey: ['module-assignments'], queryFn: getAssignments, enabled: isUser });
  const { data: projectTasks = [] } = useQuery({ queryKey: ['project-tasks'], queryFn: getProjectTasks, enabled: isUser });
  const { data: ayamEntries = [] } = useQuery({ queryKey: ['ayam-entries'], queryFn: getAyamEntries, enabled: isUser });
  const { data: hierarchyNodes = [] } = useQuery({ queryKey: ['hierarchy-nodes'], queryFn: getHierarchyNodes, enabled: isUser });
  const nodeMap = React.useMemo(() => new Map(hierarchyNodes.map((node) => [node.id, node])), [hierarchyNodes]);

  const assignedCards = React.useMemo(
    () => {
      const cards: Array<{ id: string; titleHi: string; titleEn: string; area: string; level: string; icon: keyof typeof Ionicons.glyphMap; nodeId?: string | null; assignmentKey?: string }> = [];
      const sensitiveByNode = Array.from(new Set(sensitiveEntries.map((item) => item.nodeId)));
      sensitiveByNode.forEach((nodeId, idx) => {
        const node = nodeMap.get(nodeId);
        cards.push({
          id: `s-${nodeId}-${idx}`,
          titleHi: 'संवेदनशील',
          titleEn: 'Sensitive',
          area: node ? `${node.name_hi} / ${node.name_en}` : nodeId,
          level: node?.level ?? 'ASSIGNED',
          icon: 'alert-circle-outline',
          nodeId
        });
      });

      Array.from(new Set(projectTasks.map((item) => item.projectCategory))).forEach((category, idx) => {
        cards.push({
          id: `p-${category}-${idx}`,
          titleHi: 'प्रकल्प',
          titleEn: 'Project',
          area: category,
          level: nodeMap.get(assignedNodeId ?? '')?.level ?? 'ASSIGNED',
          icon: 'shield-checkmark-outline',
          assignmentKey: category
        });
      });

      if (activities.length) {
        cards.push({
          id: 'a-module',
          titleHi: 'गतिविधियां',
          titleEn: 'Activities',
          area: `${activities.length} assigned`,
          level: nodeMap.get(assignedNodeId ?? '')?.level ?? 'ASSIGNED',
          icon: 'images-outline'
        });
      }

      if (dharmRaksha.length) {
        cards.push({
          id: 'dr-module',
          titleHi: 'धर्म रक्षा समिति',
          titleEn: 'Dharm Raksha Samiti',
          area: `${dharmRaksha.length} assigned`,
          level: nodeMap.get(assignedNodeId ?? '')?.level ?? 'ASSIGNED',
          icon: 'shield-checkmark-outline'
        });
      }

      Array.from(new Set(ayamEntries.map((item) => item.subCategory))).forEach((subCategory, idx) => {
        cards.push({
          id: `y-${subCategory}-${idx}`,
          titleHi: 'आयाम',
          titleEn: 'Ayam',
          area: subCategory,
          level: nodeMap.get(assignedNodeId ?? '')?.level ?? 'ASSIGNED',
          icon: 'book-outline',
          assignmentKey: subCategory
        });
      });

      if (isFullTime) {
        cards.push({
          id: 'ft-1',
          titleHi: 'पूर्णकालिक कार्य',
          titleEn: 'FullTime Work',
          area: nodeMap.get(assignedNodeId ?? '') ? `${nodeMap.get(assignedNodeId ?? '')?.name_hi} / ${nodeMap.get(assignedNodeId ?? '')?.name_en}` : 'Assigned Locations',
          level: nodeMap.get(assignedNodeId ?? '')?.level ?? 'ASSIGNED',
          icon: 'briefcase-outline'
        });
      }

      assignments.forEach((assignment, idx) => {
        if (assignment.moduleType === 'Project') {
          cards.push({
            id: `asg-p-${assignment.id}-${idx}`,
            titleHi: 'प्रकल्प',
            titleEn: 'Project',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'shield-checkmark-outline',
            nodeId: assignment.nodeId,
            assignmentKey: assignment.assignmentKey
          });
          return;
        }
        if (assignment.moduleType === 'Ayam') {
          cards.push({
            id: `asg-a-${assignment.id}-${idx}`,
            titleHi: 'आयाम',
            titleEn: 'Ayam',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'book-outline',
            nodeId: assignment.nodeId,
            assignmentKey: assignment.assignmentKey
          });
          return;
        }
        if (assignment.moduleType === 'Sensitive') {
          cards.push({
            id: `asg-s-${assignment.id}-${idx}`,
            titleHi: 'संवेदनशील',
            titleEn: 'Sensitive',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'alert-circle-outline',
            nodeId: assignment.nodeId,
            assignmentKey: assignment.assignmentKey
          });
          return;
        }
        if (assignment.moduleType === 'Activities') {
          cards.push({
            id: `asg-act-${assignment.id}-${idx}`,
            titleHi: 'गतिविधियां',
            titleEn: 'Activities',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'images-outline',
            nodeId: assignment.nodeId,
            assignmentKey: assignment.assignmentKey
          });
          return;
        }
        if (assignment.moduleType === 'DharmRaksha') {
          cards.push({
            id: `asg-dr-${assignment.id}-${idx}`,
            titleHi: 'धर्म रक्षा समिति',
            titleEn: 'Dharm Raksha Samiti',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'shield-checkmark-outline'
          });
          return;
        }
        if (assignment.moduleType === 'FullTime' && isFullTime) {
          cards.push({
            id: `asg-ft-${assignment.id}-${idx}`,
            titleHi: 'पूर्णकालिक कार्य',
            titleEn: 'FullTime Work',
            area: assignment.assignmentKey,
            level: nodeMap.get(assignment.nodeId ?? assignedNodeId ?? '')?.level ?? 'ASSIGNED',
            icon: 'briefcase-outline'
          });
        }
      });

      return cards;
    },
    [activities.length, assignedNodeId, assignments, ayamEntries, dharmRaksha.length, isFullTime, nodeMap, projectTasks, sensitiveEntries, fulltimeTasks.length]
  );
  const dedupedAssignedCards = React.useMemo(() => {
    const map = new Map<string, (typeof assignedCards)[number]>();
    assignedCards.forEach((card) => {
      map.set(`${card.titleEn}|${card.area}`, card);
    });
    return Array.from(map.values());
  }, [assignedCards]);
  const visibleCards = isUser ? [...defaultCards, ...dedupedAssignedCards] : [...defaultCards, ...dedupedAssignedCards];
  const [viewMode, setViewMode] = React.useState<'cards' | 'table'>('cards');

  const onCardPress = (card: { titleEn: string; nodeId?: string | null; assignmentKey?: string }) => {
    const params = { nodeId: card.nodeId ?? undefined, assignmentKey: card.assignmentKey };
    const titleEn = card.titleEn;
    if (titleEn === 'Sensitive') {
      navigation.navigate('SensitiveDetail', params);
      return;
    }
    if (titleEn === 'Activities') {
      navigation.navigate('ActivityForm', params);
      return;
    }
    if (titleEn === 'Pralekhan' || titleEn === 'Ayam') {
      navigation.navigate('AyamDetail', params);
      return;
    }
    if (titleEn === 'Dharm Raksha Samiti' || titleEn === 'Project') {
      if (titleEn === 'Dharm Raksha Samiti') {
        navigation.navigate('DharmRaksha' as never);
        return;
      }
      navigation.navigate('ProjectTask', params);
      return;
    }
    if (titleEn === 'FullTime Work') {
      navigation.navigate('FullTimeWork' as never);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="home screen">
      <View style={styles.introCard}>
        <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
        <Text style={styles.introText}>Welcome back. Your assigned modules are ready for update.</Text>
      </View>
      <View style={styles.viewToggleRow}>
        <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'cards' && styles.viewToggleBtnActive]} onPress={() => setViewMode('cards')}>
          <Text style={[styles.viewToggleText, viewMode === 'cards' && styles.viewToggleTextActive]}>Cards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'table' && styles.viewToggleBtnActive]} onPress={() => setViewMode('table')}>
          <Text style={[styles.viewToggleText, viewMode === 'table' && styles.viewToggleTextActive]}>Table</Text>
        </TouchableOpacity>
      </View>
      {viewMode === 'cards' ? (
        <FlatList
          data={visibleCards}
          renderItem={({ item }) => (
            <FlatListCard
              titleHi={item.titleHi}
              titleEn={item.titleEn}
              area={item.area}
              level={item.level}
              icon={item.icon}
              onPress={() => onCardPress(item)}
            />
          )}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.tableRow, styles.headerRow]}>
              <Text style={[styles.cell, styles.wModule, styles.headerText]}>Module</Text>
              <Text style={[styles.cell, styles.wArea, styles.headerText]}>Area</Text>
              <Text style={[styles.cell, styles.wLevel, styles.headerText]}>Level</Text>
              <Text style={[styles.cell, styles.wAction, styles.headerText]}>Action</Text>
            </View>
            {visibleCards.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.wModule]}>{item.titleEn}</Text>
                <Text style={[styles.cell, styles.wArea]}>{item.area}</Text>
                <Text style={[styles.cell, styles.wLevel]}>{item.level}</Text>
                <View style={[styles.cell, styles.wAction]}>
                  <TouchableOpacity style={styles.openBtn} onPress={() => onCardPress(item)}>
                    <Text style={styles.openText}>Open</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7f1',
    borderWidth: 1,
    borderColor: '#ffe0cc'
  },
  introText: {
    marginLeft: 8,
    flex: 1,
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '600'
  },
  viewToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  viewToggleBtn: { flex: 1, borderWidth: 1, borderColor: '#d9dde7', borderRadius: 10, backgroundColor: '#fff', paddingVertical: 8, alignItems: 'center' },
  viewToggleBtnActive: { borderColor: '#c6d7ff', backgroundColor: '#edf3ff' },
  viewToggleText: { color: Colors.textSecondary, fontWeight: '700' },
  viewToggleTextActive: { color: Colors.secondary },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  headerRow: { backgroundColor: '#f5f7fb' },
  headerText: { fontWeight: '700', color: Colors.secondary },
  cell: { padding: 10, color: Colors.textPrimary, fontSize: 12 },
  wModule: { width: 140 },
  wArea: { width: 260 },
  wLevel: { width: 90 },
  wAction: { width: 100 },
  openBtn: { backgroundColor: '#edf3ff', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  openText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 }
});
