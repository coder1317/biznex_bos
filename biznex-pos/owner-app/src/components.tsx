import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, F } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Stat({
  label,
  value,
  tone = C.text,
  sub,
}: {
  label: string;
  value: string | number;
  tone?: string;
  sub?: string;
}) {
  return (
    <Card style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: tone }]} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={s.statSub} numberOfLines={1}>{sub}</Text> : null}
    </Card>
  );
}

export function Badge({ children, color = C.faint, bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg || `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[s.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={C.accent} />
      <Text style={s.loadingText}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  stat: { flex: 1, minWidth: '46%' },
  statLabel: {
    color: C.faint,
    fontSize: F.xs - 1,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: { color: C.text, fontSize: F.lg, fontWeight: '800', marginTop: 4 },
  statSub: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: F.xs - 1, fontWeight: '700' },
  loading: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  loadingText: { color: C.faint, fontSize: F.sm },
  sectionTitle: {
    color: C.text,
    fontSize: F.md,
    fontWeight: '700',
    marginBottom: 10,
  },
});
