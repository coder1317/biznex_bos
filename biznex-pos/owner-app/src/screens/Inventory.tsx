import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { inr } from '../api';
import { useCache, useSyncedAt } from '../store';
import { syncAll } from '../sync';
import { Badge, Card, SectionTitle } from '../components';
import { C, F } from '../theme';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category_name: string | null;
  sale_price: number;
  stock_qty: number;
  reorder_threshold: number;
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function Inventory() {
  // Cache-first: products + valuation come from the local store instantly.
  const cached = useCache<{ products: Product[] }>('products');
  const valuation = useCache<{ costValue: number; saleValue: number }>('valuation');
  const syncedAt = useSyncedAt('products');
  const products = cached?.products ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncAll(true);
    setRefreshing(false);
  };

  const low = products.filter((p) => p.stock_qty <= p.reorder_threshold);
  const out = products.filter((p) => p.stock_qty <= 0);
  const sorted = [...products].sort((a, b) => a.stock_qty - b.stock_qty);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={s.headRow}>
        <Text style={s.title}>Inventory</Text>
        {syncedAt ? <Text style={s.syncNote}>synced {timeAgo(syncedAt)}</Text> : null}
      </View>

      <View style={s.stats}>
        <View style={[s.chip, { flex: 1 }]}>
          <Text style={s.chipLabel}>Stock value</Text>
          <Text style={[s.chipValue, { color: C.green }]}>{inr(valuation?.saleValue ?? 0)}</Text>
        </View>
        <View style={[s.chip, { flex: 1 }]}>
          <Text style={s.chipLabel}>Low stock</Text>
          <Text style={[s.chipValue, { color: low.length ? C.amber : C.text }]}>{low.length}</Text>
        </View>
        <View style={[s.chip, { flex: 1 }]}>
          <Text style={s.chipLabel}>Out of stock</Text>
          <Text style={[s.chipValue, { color: out.length ? C.red : C.text }]}>{out.length}</Text>
        </View>
      </View>

      {low.length > 0 && (
        <>
          <SectionTitle>Needs attention</SectionTitle>
          <View style={{ gap: 8 }}>
            {low.map((p) => (
              <Card key={p.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.cat}>{p.category_name || 'Uncategorized'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.stock}>{p.stock_qty} left</Text>
                  <Badge color={p.stock_qty <= 0 ? C.red : C.amber} bg={p.stock_qty <= 0 ? `${C.red}22` : `${C.amber}22`}>
                    {p.stock_qty <= 0 ? 'Out of stock' : 'Low stock'}
                  </Badge>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}

      <SectionTitle>All products ({products.length})</SectionTitle>
      <View style={{ gap: 8 }}>
        {sorted.map((p) => (
          <Card key={p.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.cat}>{p.category_name || 'Uncategorized'} · {p.sku || 'no SKU'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.price}>{inr(p.sale_price)}</Text>
              <Text style={s.stock}>{p.stock_qty} in stock</Text>
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
  stats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  chipLabel: { color: C.faint, fontSize: F.xs - 1, fontWeight: '700', textTransform: 'uppercase' },
  chipValue: { color: C.text, fontSize: F.md, fontWeight: '800', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: C.text, fontSize: F.sm, fontWeight: '600' },
  cat: { color: C.faint, fontSize: F.xs, marginTop: 2 },
  price: { color: C.accentLight, fontSize: F.sm, fontWeight: '700' },
  stock: { color: C.faint, fontSize: F.xs },
});
