import React, { useEffect, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, inr } from '../api';
import { useCache, useSyncedAt } from '../store';
import { refreshDataset } from '../sync';
import { Badge, Card } from '../components';
import { C, F } from '../theme';

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  order_type: string;
  payment_method: string;
  status: string;
  customer_name?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  items?: { id: number; product_name: string; quantity: number; line_total: number }[];
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Orders() {
  // Cache-first: instant from the local store, kept fresh by the sync engine.
  const cached = useCache<{ orders: Order[] }>('orders');
  const syncedAt = useSyncedAt('orders');
  const orders = cached?.orders ?? [];
  const [selected, setSelected] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDataset('orders');
    setRefreshing(false);
  };

  const openDetail = async (id: number) => {
    try {
      const d = await api<{ order: Order }>(`/orders/${id}`);
      setSelected(d.order);
    } catch {
      /* offline — detail view unavailable */
    }
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={s.headRow}>
        <Text style={s.title}>Orders</Text>
        {syncedAt ? <Text style={s.syncNote}>synced {timeAgo(syncedAt)}</Text> : null}
      </View>
      {orders.length === 0 ? (
        <Card><Text style={s.empty}>No orders yet — will appear after the first sync.</Text></Card>
      ) : (
        <View style={{ gap: 8 }}>
          {orders.map((o) => (
            <TouchableOpacity key={o.id} onPress={() => openDetail(o.id)} activeOpacity={0.7}>
              <Card style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.number}>{o.order_number}</Text>
                  <Text style={s.time}>{o.created_at}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.total}>{inr(o.total_amount)}</Text>
                  <Badge color={C.accentLight}>{o.payment_method}</Badge>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.modalWrap}>
          <Card style={s.modalCard}>
            {selected && (
              <>
                <Text style={s.modalTitle}>{selected.order_number}</Text>
                <Text style={s.modalSub}>{selected.created_at} · {selected.order_type}</Text>

                <View style={{ gap: 8, marginTop: 14 }}>
                  {selected.items?.map((it) => (
                    <View key={it.id} style={s.itemRow}>
                      <Text style={s.itemName} numberOfLines={1}>{it.product_name} × {it.quantity}</Text>
                      <Text style={s.itemTotal}>{inr(it.line_total)}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.totals}>
                  <Text style={s.totalRow}>Subtotal <Text style={s.totalVal}>{inr(selected.subtotal)}</Text></Text>
                  <Text style={s.totalRow}>Tax <Text style={s.totalVal}>{inr(selected.tax_amount)}</Text></Text>
                  {Number(selected.discount_amount) > 0 && (
                    <Text style={[s.totalRow, { color: C.green }]}>Discount <Text style={s.totalVal}>−{inr(selected.discount_amount)}</Text></Text>
                  )}
                  <View style={s.totalDivider} />
                  <Text style={[s.totalRow, { color: C.accentLight, fontWeight: '800' }]}>
                    Total <Text style={s.totalVal}>{inr(selected.total_amount)}</Text>
                  </Text>
                </View>

                <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={s.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: C.text, fontSize: F.lg, fontWeight: '800' },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  syncNote: { color: C.faint, fontSize: F.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  number: { color: C.accentLight, fontFamily: 'monospace', fontSize: F.sm, fontWeight: '600' },
  time: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  total: { color: C.text, fontSize: F.md, fontWeight: '700' },
  empty: { color: C.faint, fontSize: F.sm, textAlign: 'center', paddingVertical: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxHeight: '85%' },
  modalTitle: { color: C.text, fontSize: F.lg, fontWeight: '800' },
  modalSub: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  itemName: { color: C.text, fontSize: F.sm, flex: 1 },
  itemTotal: { color: C.dim, fontSize: F.sm },
  totals: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 14, paddingTop: 10, gap: 4 },
  totalRow: { color: C.dim, fontSize: F.sm },
  totalVal: { color: C.text, fontWeight: '700' },
  totalDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  closeBtn: {
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeText: { color: C.text, fontSize: F.sm, fontWeight: '700' },
});
