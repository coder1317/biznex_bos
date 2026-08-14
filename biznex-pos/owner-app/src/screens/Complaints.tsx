import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { useCache, useSyncedAt } from '../store';
import { refreshDataset } from '../sync';
import { Badge, Card } from '../components';
import { C, F } from '../theme';

interface Complaint {
  id: number;
  title: string;
  description: string;
  severity: 'Low' | 'Normal' | 'High';
  status: 'Submitted' | 'In Progress' | 'Resolved';
  user_name?: string | null;
  created_at: string;
}

const SEV_COLOR = { Low: C.cyan, Normal: C.amber, High: C.red };
const STATUS_COLOR = { Submitted: C.faint, 'In Progress': C.accentLight, Resolved: C.green };

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Complaints() {
  // Cache-first: complaints from the local store, refreshed in background.
  const cached = useCache<{ complaints: Complaint[] }>('complaints');
  const syncedAt = useSyncedAt('complaints');
  const items = cached?.complaints ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'Normal' });
  const [saving, setSaving] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDataset('complaints');
    setRefreshing(false);
  };

  const submit = async () => {
    if (!form.title || !form.description || saving) return;
    setSaving(true);
    try {
      await api('/complaints', { method: 'POST', body: form });
      setComposing(false);
      setForm({ title: '', description: '', severity: 'Normal' });
      refreshDataset('complaints');
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  const open = items.filter((c) => c.status !== 'Resolved').length;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Complaints</Text>
          <Text style={s.sub}>{open} open · {items.length} total{syncedAt ? ` · synced ${timeAgo(syncedAt)}` : ''}</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setComposing(true)}>
          <Text style={s.newText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Card><Text style={s.empty}>No complaints — great!</Text></Card>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((c) => (
            <Card key={c.id}>
              <View style={s.rowHead}>
                <Text style={s.name} numberOfLines={1}>{c.title}</Text>
                <Badge color={SEV_COLOR[c.severity] || C.dim}>{c.severity}</Badge>
                <Badge color={STATUS_COLOR[c.status] || C.faint}>{c.status}</Badge>
              </View>
              <Text style={s.desc}>{c.description}</Text>
              <Text style={s.meta}>{c.user_name || '—'} · {c.created_at}</Text>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={composing} transparent animationType="fade" onRequestClose={() => setComposing(false)}>
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Card style={s.modalCard}>
            <Text style={s.modalTitle}>File a complaint</Text>
            <TextInput
              style={s.input}
              placeholder="Title — e.g. Card machine not working"
              placeholderTextColor={C.faint}
              value={form.title}
              onChangeText={(t) => setForm({ ...form, title: t })}
            />
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="What happened?"
              placeholderTextColor={C.faint}
              multiline
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {(['Low', 'Normal', 'High'] as const).map((sev) => (
                <TouchableOpacity
                  key={sev}
                  style={[s.sevBtn, form.severity === sev && { backgroundColor: `${SEV_COLOR[sev]}22`, borderColor: SEV_COLOR[sev] }]}
                  onPress={() => setForm({ ...form, severity: sev })}
                >
                  <Text style={[s.sevText, { color: form.severity === sev ? SEV_COLOR[sev] : C.dim }]}>{sev}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                <Text style={s.submitText}>{saving ? 'Sending…' : 'File complaint'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setComposing(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: C.text, fontSize: F.lg, fontWeight: '800' },
  sub: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  newBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newText: { color: '#fff', fontSize: F.sm, fontWeight: '700' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: C.text, fontSize: F.sm, fontWeight: '700', flexShrink: 1 },
  desc: { color: C.dim, fontSize: F.sm, marginTop: 8, lineHeight: 20 },
  meta: { color: C.faint, fontSize: F.xs, marginTop: 8 },
  empty: { color: C.faint, fontSize: F.sm, textAlign: 'center', paddingVertical: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%' },
  modalTitle: { color: C.text, fontSize: F.lg, fontWeight: '800', marginBottom: 12 },
  input: {
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.text,
    fontSize: F.sm,
    marginBottom: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  sevBtn: {
    flex: 1,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  sevText: { fontSize: F.sm, fontWeight: '700' },
  submitBtn: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: F.sm, fontWeight: '700' },
  cancelBtn: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  cancelText: { color: C.text, fontSize: F.sm, fontWeight: '600' },
});
