const fs = require('fs');
const file = '/home/dhruv/work-dhruv/hph/seervi-family/seervi-revamp/seerviportal/sp_v2/els/kids/app/services/family-tree/components/CreateLineageModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// The new component ends with:
//       <LineagePickerModal
//         visible={showAdoptedPicker}
//         title="Select Adopted Parent Lineage"
//         ...
//         noneLabel="Select adopted parent"
//       />
//     </Modal>
//   );
// };

// There is a duplicated interface and component definition after that.
// Let's remove from "interface CreateLineageModalProps {" (the SECOND occurrence) 
// up to the second "};" before "const styles = StyleSheet.create({"

const lines = content.split('\n');
let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  if (i > 700 && lines[i].startsWith('interface CreateLineageModalProps {') && lines[i-1] === '' && lines[i-2] === '') {
    skip = true;
  }
  if (skip && lines[i] === '};' && lines[i+2] && lines[i+2].startsWith('const styles = StyleSheet.create({')) {
    skip = false;
    continue; // skip this closing brace too
  }
  
  if (!skip) {
    newLines.push(lines[i]);
  }
}

content = newLines.join('\n');

// Now add the new styles into StyleSheet.create({
const stylesToAdd = `
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 26, 21, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerSheetClose: {
    fontSize: 20,
    color: '#666',
  },
  pickerList: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerRowActive: {
    backgroundColor: '#eff6ff',
    borderColor: theme.colors.primary,
  },
  pickerRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  pickerRowTextActive: {
    color: theme.colors.primary,
  },
  pickerCheck: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectTriggerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectPlaceholder: {
    color: '#999',
  },
  selectChevron: {
    fontSize: 16,
    color: '#999',
    marginLeft: 10,
  },`;

content = content.replace('const styles = StyleSheet.create({', 'const styles = StyleSheet.create({' + stylesToAdd);

// Also remove `pickerWrap` as it's no longer used
content = content.replace(/  pickerWrap: \{\n    borderWidth: 1,\n    borderColor: '#ddd',\n    borderRadius: 8,\n    overflow: 'hidden',\n    backgroundColor: '#fff',\n  \},\n/g, '');


fs.writeFileSync(file, content);
console.log('Fixed file');
