import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeConn, getConnState, getServerUrl, getStoredUser, inr, ConnState } from '../api';
import { useCache, useSyncedAt } from '../store';
import { refreshDataset, syncAll } from '../sync';
import { Card } from '../components';
import { C, F } from '../theme';

interface Dash {
  today: { orders: number; revenue: number; avgTicket: number };
  monthRevenue: number;
  lowStockCount: number;
  activeStaffCount: number;
  paymentBreakdown: { method: string; count: number; total: number }[];
  recentOrders: { id: number; order_number: string; created_at: string; payment_method: string; total_amount: number; status: string }[];
}

const PAY_COLORS: Record<string, string> = { Cash: C.green, UPI: C.accent, Card: C.purple, Wallet: C.cyan };

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard({ onOpenSettings }: { onOpenSettings?: () => void }) {
  // Cache-first: these resolve instantly from the local store (possibly from a
  // previous session) and re-render when the sync engine writes fresh data.
  const data = useCache<Dash>('dashboard');
  const range = useCache<{ series: { day: string; revenue: number }[] }>('sales-range');
  const syncedAt = useSyncedAt('dashboard');
  const [conn, setConn] = useState<ConnState>(getConnState());
  const [refreshing, setRefreshing] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    getServerUrl().then(setServerUrl);
    getStoredUser().then((u) => u && setUserName(u.name || u.username));
  }, []);

  useEffect(() => subscribeConn(setConn), []);

  // Pull-to-refresh forces a background re-sync of just the dashboard stats.
  const onRefresh = async () => {
    setRefreshing(true);
    await syncAll(true);
    setRefreshing(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${userName ? `, ${userName.split(' ')[0]}` : ''}`;
  })();

  const series = range?.series ?? [];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Header — greeting + live connection pill (portal style) */}
      <View style={s.hdr}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{greeting}</Text>
          <Text style={s.hdrSub}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
            {syncedAt ? ` · updated ${timeAgo(syncedAt)}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={[s.pill, { borderColor: conn === 'online' ? `${C.green}66` : conn === 'connecting' ? `${C.amber}66` : `${C.red}66` }]} onPress={onOpenSettings} activeOpacity={0.8}>
          <View style={[s.dot, { backgroundColor: conn === 'online' ? C.green : conn === 'connecting' ? C.amber : C.red }]} />
          <Text style={[s.pillText, { color: conn === 'online' ? C.green : conn === 'connecting' ? C.amber : C.red }]}>
            {conn === 'online' ? 'Live' : conn === 'connecting' ? 'Connecting' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* KPI grid — from cache; shows last-known numbers even offline */}
      <View style={s.kpiGrid}>
        <Kpi label="Revenue today" value={inr(data?.today.revenue ?? 0)} tone={C.accentLight} />
        <Kpi label="Transactions" value={data?.today.orders ?? 0} />
        <Kpi label="Avg ticket" value={inr(data?.today.avgTicket ?? 0)} />
        <Kpi label="Month total" value={inr(data?.monthRevenue ?? 0)} tone={C.green} />
        <Kpi label="Low stock" value={data?.lowStockCount ?? 0} tone={(data?.lowStockCount ?? 0) > 0 ? C.amber : C.text} />
        <Kpi label="Active staff" value={data?.activeStaffCount ?? 0} />
      </View>

      {/* Revenue — last 7 days (cached series, same chart) */}
      <Card style={s.card}>
        <Text style={s.cardTitle}>Revenue — last 7 days</Text>
        {series.length === 0 ? (
          <Text style={s.empty}>No sales data yet — will appear after first sync.</Text>
        ) : (
          <BarChart data={series} />
        )}
      </Card>

      {/* Payment method split */}
      {data && data.paymentBreakdown.length > 0 && (
        <Card style={s.card}>
          <Text style={s.cardTitle}>Payments today</Text>
          <View style={{ gap: 12, marginTop: 12 }}>
            {data.paymentBreakdown.map((p) => (
              <View key={p.method}>
                <View style={s.payRow}>
                  <Text style={s.payMethod}>{p.method}</Text>
                  <Text style={s.payValue}>
                    {p.count} × {inr(p.total)}
                  </Text>
                </View>
                <View style={s.payTrack}>
                  <View style={[s.payFill, { width: `${Math.max(4, (p.total / Math.max(...data.paymentBreakdown.map((x) => x.total), 1)) * 100)}%`, backgroundColor: PAY_COLORS[p.method] || C.accent }]} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Recent orders — from the synced dashboard payload */}
      <Text style={s.feedTitle}>Recent orders</Text>
      {!data || data.recentOrders.length === 0 ? (
        <Card>
          <Text style={s.empty}>No orders yet — they'll appear here as sales happen.</Text>
        </Card>
      ) : (
        <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          {data.recentOrders.slice(0, 8).map((o) => (
            <View key={o.id} style={s.actRow}>
              <View style={[s.actDot, { backgroundColor: PAY_COLORS[o.payment_method] || C.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.actText}>{o.order_number}</Text>
                <Text style={s.actMeta}>
                  {inr(o.total_amount)} · {o.payment_method || '—'} · {timeAgo(new Date(o.created_at).getTime())}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Text style={s.connNote} numberOfLines={1}>Store: {serverUrl}</Text>
    </ScrollView>
  );
}

function Kpi({ label, value, tone = C.text }: { label: string; value: string | number; tone?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, { color: tone }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function BarChart({ data }: { data: { day: string; revenue: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6, marginTop: 14 }}>
      {data.map((d, i) => {
        const h = Math.max(5, (d.revenue / max) * 90);
        const label = new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' });
        return (
          <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: '70%',
                height: h,
                borderRadius: 4,
                backgroundColor: i === data.length - 1 ? C.accent : `${C.accent}88`,
              }}
            />
            <Text style={s.chartLabel}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  greeting: { color: C.text, fontSize: F.lg, fontWeight: '800', letterSpacing: -0.3 },
  hdrSub: { color: C.dim, fontSize: F.xs, marginTop: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: F.xs, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpi: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  kpiLabel: {
    color: C.faint,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  kpiValue: { fontSize: F.lg, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  card: { marginBottom: 14 },
  cardTitle: { color: C.text, fontSize: F.sm, fontWeight: '700' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  payMethod: { color: C.text, fontSize: F.sm, fontWeight: '600' },
  payValue: { color: C.dim, fontSize: F.sm, fontVariant: ['tabular-nums'] },
  payTrack: { height: 5, borderRadius: 3, backgroundColor: C.bg2, overflow: 'hidden' },
  payFill: { height: 5, borderRadius: 3 },
  feedTitle: { color: C.text, fontSize: F.md, fontWeight: '700', marginBottom: 10 },
  actRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  actDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  actText: { color: C.text, fontSize: F.sm, fontWeight: '600' },
  actMeta: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  empty: { color: C.faint, fontSize: F.sm, textAlign: 'center', paddingVertical: 10 },
  chartLabel: { color: C.faint, fontSize: F.xs - 1 },
  connNote: { color: C.faint, fontSize: F.xs, textAlign: 'center', marginTop: 18, fontFamily: 'monospace' },
});
