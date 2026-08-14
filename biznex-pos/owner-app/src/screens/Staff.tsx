import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCache, useSyncedAt } from '../store';
import { refreshDataset } from '../sync';
import { Badge, Card, SectionTitle } from '../components';
import { C, F } from '../theme';

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
}

const ROLE_COLOR: Record<string, string> = {
  owner: C.accentLight,
  admin: C.purple,
  manager: C.cyan,
  cashier: C.dim,
};

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Staff() {
  // Cache-first: staff list from the local store, refreshed in background.
  const cached = useCache<{ users: User[] }>('users');
  const syncedAt = useSyncedAt('users');
  const users = cached?.users ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDataset('users');
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={s.headRow}>
        <Text style={s.title}>Staff</Text>
        {syncedAt ? <Text style={s.syncNote}>synced {timeAgo(syncedAt)}</Text> : null}
      </View>
      <SectionTitle>{users.filter((u) => u.isActive).length} active of {users.length}</SectionTitle>

      <View style={{ gap: 8 }}>
        {users.map((u) => (
          <Card key={u.id} style={s.row}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(u.name || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}</Text>
              <Text style={s.username}>{u.username}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge color={ROLE_COLOR[u.role] || C.dim}>{u.role}</Badge>
              <Badge color={u.isActive ? C.green : C.faint} bg={u.isActive ? `${C.green}22` : `${C.faint}22`}>
                {u.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: C.text, fontSize: F.lg, fontWeight: '800' },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  syncNote: { color: C.faint, fontSize: F.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card2,
    borderColor: C.border2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.text, fontSize: F.md, fontWeight: '800' },
  name: { color: C.text, fontSize: F.sm, fontWeight: '600' },
  username: { color: C.faint, fontSize: F.xs, marginTop: 2 },
});
