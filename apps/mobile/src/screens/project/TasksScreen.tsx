import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createVanshavaliNode, getVanshavaliNodes } from '@/api/ayam.api';
import { DottedAddCard } from '@/components/DottedAddCard';
import { TreeView } from '@/components/TreeView';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const FieldLabel = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

export const TasksScreen = (): React.JSX.Element => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const isFullTime = useAuthStore((state) => state.isFullTime);
  const { data: nodes = [] } = useQuery({ queryKey: ['vanshavali-nodes'], queryFn: getVanshavaliNodes });
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const [formState, setFormState] = React.useState({
    parentId: null as string | null,
    name: '',
    religion: '',
    caste: '',
    gotra: '',
    from: '',
    till: ''
  });

  const createMutation = useMutation({
    mutationFn: createVanshavaliNode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vanshavali-nodes'] });
      setFormState({ parentId: null, name: '', religion: '', caste: '', gotra: '', from: '', till: '' });
      setShowCreateForm(false);
    }
  });

  const submit = async () => {
    if (!formState.name || !formState.religion || !formState.caste || !formState.gotra) {
      Alert.alert('Missing fields', 'Please fill name, religion, caste and gotra.');
      return;
    }
    await createMutation.mutateAsync(formState);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} accessibilityLabel="vanshavali tree screen">
      <Text style={styles.title}>Vanshavali Tree</Text>
      <Text style={styles.subtitle}>Create lineage nodes and manage family relationships.</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('DharmRaksha' as never)}>
          <Text style={styles.quickTitle}>Dharm Raksha</Text>
          <Text style={styles.quickSub}>Open Samiti module</Text>
        </TouchableOpacity>
        {isFullTime ? (
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('FullTimeWork' as never)}>
            <Text style={styles.quickTitle}>FullTime Work</Text>
            <Text style={styles.quickSub}>Open task module</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TreeView
        nodes={nodes.map((node) => ({
          id: node.id,
          parentId: node.parentId,
          title: node.name,
          subtitle: `${node.religion} • ${node.caste} • ${node.gotra}`,
          badge: node.parentId ? 'Child' : 'Root'
        }))}
        emptyText="No vanshavali nodes found."
      />

      {!showCreateForm ? (
        <DottedAddCard label="Vanshavali Node Form" onPress={() => setShowCreateForm(true)} />
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add Vanshavali Node</Text>
          <FieldLabel text="Attach To" />
          <View style={styles.pickerWrap}>
            <Picker selectedValue={formState.parentId ?? ''} onValueChange={(value) => setFormState((prev) => ({ ...prev, parentId: value || null }))}>
              <Picker.Item label="Root Node" value="" />
              {nodes.map((node) => (
                <Picker.Item key={node.id} label={node.name} value={node.id} />
              ))}
            </Picker>
          </View>
          <FieldLabel text="Name" />
          <TextInput style={styles.input} value={formState.name} onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))} placeholder="Member name" />
          <FieldLabel text="Religion" />
          <TextInput style={styles.input} value={formState.religion} onChangeText={(value) => setFormState((prev) => ({ ...prev, religion: value }))} placeholder="Religion" />
          <FieldLabel text="Caste" />
          <TextInput style={styles.input} value={formState.caste} onChangeText={(value) => setFormState((prev) => ({ ...prev, caste: value }))} placeholder="Caste" />
          <FieldLabel text="Gotra" />
          <TextInput style={styles.input} value={formState.gotra} onChangeText={(value) => setFormState((prev) => ({ ...prev, gotra: value }))} placeholder="Gotra" />
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FieldLabel text="From Date" />
              <TextInput style={styles.input} value={formState.from} onChangeText={(value) => setFormState((prev) => ({ ...prev, from: value }))} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.halfInput}>
              <FieldLabel text="Till Date" />
              <TextInput style={styles.input} value={formState.till} onChangeText={(value) => setFormState((prev) => ({ ...prev, till: value }))} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelBtn]} onPress={() => setShowCreateForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.saveBtn]} onPress={() => void submit()} accessibilityLabel="create vanshavali node button">
              <Text style={styles.saveText}>Create Node</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  subtitle: { color: Colors.textSecondary, marginBottom: 12 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e6ef', borderRadius: 12, padding: 10 },
  quickTitle: { fontWeight: '700', color: Colors.secondary },
  quickSub: { marginTop: 3, color: Colors.textSecondary, fontSize: 12 },
  formCard: { borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ef', backgroundColor: Colors.card, padding: 12, marginTop: 12 },
  formTitle: { fontWeight: '800', color: Colors.secondary, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  pickerWrap: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eef1f6' },
  saveBtn: { backgroundColor: Colors.primary },
  cancelText: { color: Colors.secondary, fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' }
});
