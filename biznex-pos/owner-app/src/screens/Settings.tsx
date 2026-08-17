import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ORIGINAL_SERVER,
  clearSession,
  getConnState,
  getKnownServers,
  getNgrokUrl,
  getServerUrl,
  getStoredUser,
  setServerUrl,
  subscribeConn,
  testConnection,
  ConnState,
} from '../api';
import { useCache, useSyncedAt } from '../store';
import { syncAll } from '../sync';
import { Ionicons } from '@expo/vector-icons';
import ScanQr from './ScanQr';
import { Badge, Card, SectionTitle } from '../components';
import { C, F } from '../theme';

interface Settings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  gstin: string;
  currency: string;
  default_tax_rate: string;
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


export default function Settings({ onLogout }: { onLogout: () => void }) {
  // Store info comes from the local cache (synced in the background).
  const cachedSettings = useCache<{ settings: Settings }>('settings');
  const settings = cachedSettings?.settings ?? null;
  const [serverUrl, setUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [conn, setConn] = useState<ConnState>(getConnState());
  const [servers, setServers] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Local state (server address, known servers, user) always loads — even
    // when the store server is unreachable, so the address can be changed.
    const [stored, known, u, ngrok] = await Promise.all([
      getServerUrl(),
      getKnownServers(),
      getStoredUser(),
      getNgrokUrl(),
    ]);
    setUrl(stored);
    setUrlInput(stored);
    setServers(known);
    setNgrokUrl(ngrok);
    setUser(u);
  }, []);

  useEffect(() => {
    load();
    return subscribeConn(setConn);
  }, [load]);

  const runTest = async (url: string) => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(url);
    setTestResult(ok ? 'ok' : 'fail');
    setTesting(false);
  };

  const saveUrl = async () => {
    const next = urlInput.trim();
    setTestResult(null);
    await setServerUrl(next);
    setUrl(next);
    setServers(await getKnownServers());
    setTestResult((await testConnection(next)) ? 'ok' : 'fail');
  };

  const logout = async () => {
    await clearSession();
    onLogout();
  };

  return (
    <View style={s.page}>
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
    >
      <Text style={s.title}>Settings</Text>

      <SectionTitle>Connection</SectionTitle>
      <Card>
        <Text style={s.label}>Store server</Text>
        <View style={s.urlRow}>
          <TextInput
            style={[s.input, s.urlInput]}
            value={urlInput}
            onChangeText={(t) => { setUrlInput(t); setTestResult(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={s.scanBtn} onPress={() => setScanning(true)} activeOpacity={0.8}>
            <Ionicons name="qr-code-outline" size={20} color={C.accentLight} />
          </TouchableOpacity>
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.testBtn} onPress={() => runTest(urlInput)} disabled={testing}>
            <Text style={s.testText}>{testing ? 'Testing…' : 'Test connection'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, (urlInput.trim() === serverUrl || testing) && { opacity: 0.5 }]}
            onPress={saveUrl}
            disabled={urlInput.trim() === serverUrl || testing}
          >
            <Text style={s.saveText}>Save &amp; connect</Text>
          </TouchableOpacity>
        </View>

        {testResult === 'ok' && <Text style={s.okText}>✓ Server reachable</Text>}
        {testResult === 'fail' && (
          <Text style={s.failText}>✗ Can't reach that address — check the Pi is on and the IP is right</Text>
        )}

        <View style={s.connRow}>
          <View style={[s.dot, { backgroundColor: conn === 'online' ? C.green : conn === 'connecting' ? C.amber : C.red }]} />
          <Text style={s.connText}>
            {conn === 'online' ? 'Connected to ' : conn === 'connecting' ? 'Connecting to ' : 'Offline — auto-searching '}
            {serverUrl}
          </Text>
        </View>
        {conn !== 'online' && (
          <Text style={s.hintText}>
            Store moved Wi-Fi? The app is scanning its network for the new IP — or tap the QR button to re-pair from the store screen.
          </Text>
        )}

        {servers.length > 0 && (
          <>
            <Text style={[s.label, { marginTop: 14 }]}>Known addresses</Text>
            {servers.map((u) => {
              const isCurrent = u === serverUrl;
              return (
                <TouchableOpacity
                  key={u}
                  style={[s.serverRow, isCurrent && { borderColor: C.accent }]}
                  onPress={() => { setUrlInput(u); runTest(u); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.serverText, { color: isCurrent ? C.accentLight : C.text }]} numberOfLines={1}>
                    {u}
                  </Text>
                  {u === ORIGINAL_SERVER && <Badge color={C.amber}>Original</Badge>}
                  {ngrokUrl && u === ngrokUrl && <Badge color={C.accentLight}>Remote</Badge>}
                  {isCurrent && <Badge color={C.green}>Current</Badge>}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </Card>

      <SectionTitle>Store</SectionTitle>
      {settings ? (
        <Card>
          <Text style={s.shopName}>{settings.shop_name}</Text>
          {settings.shop_address ? <Text style={s.meta}>{settings.shop_address}</Text> : null}
          {settings.shop_phone ? <Text style={s.meta}>Tel: {settings.shop_phone}</Text> : null}
          {settings.gstin ? <Text style={s.meta}>GSTIN: {settings.gstin}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Badge color={C.accentLight}>Tax {settings.default_tax_rate}%</Badge>
            <Badge color={C.green}>{settings.currency} INR</Badge>
          </View>
        </Card>
      ) : null}

      <SectionTitle>Data & sync</SectionTitle>
      <Card>
        <Text style={[s.meta, { lineHeight: 18 }]}>
          All data is stored on your phone and updated in the background — the app
          shows the last-synced numbers even without a connection.
        </Text>
        <View style={{ marginTop: 8, gap: 8 }}>
          <SyncRow label="Today's stats" name="dashboard" />
          <SyncRow label="7-day revenue" name="sales-range" />
          <SyncRow label="Orders" name="orders" />
          <SyncRow label="Products & stock" name="products" />
          <SyncRow label="Staff" name="users" />
          <SyncRow label="Complaints" name="complaints" />
        </View>
        <TouchableOpacity
          style={[s.saveBtn, { marginTop: 14 }]}
          onPress={async () => {
            await syncAll(true);
          }}
          disabled={refreshing}
        >
          <Text style={s.saveText}>{refreshing ? 'Syncing…' : 'Sync now'}</Text>
        </TouchableOpacity>
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        {user && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <View style={s.avatar}><Text style={s.avatarText}>{(user.name || '?')[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.shopName}>{user.name}</Text>
              <Text style={s.meta}>{user.username} · {user.role}</Text>
            </View>
          </View>
        )}
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </Card>

      <Text style={s.footer}>Biznex Owner v1.0.0 · Store server v1.0.0</Text>
    </ScrollView>

    {scanning && (
      <ScanQr
        onFound={(url) => {
          setUrlInput(url);
          setScanning(false);
          setTestResult(null);
          runTest(url);
        }}
        onClose={() => setScanning(false)}
      />
    )}
    </View>
  );
}

function SyncRow({ label, name }: { label: string; name: string }) {
  const syncedAt = useSyncedAt(name);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: C.text, fontSize: F.xs, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: syncedAt ? C.green : C.faint, fontSize: F.xs }}>
        {syncedAt ? `✓ ${timeAgo(syncedAt)}` : 'not synced yet'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, backgroundColor: C.bg },
  urlRow: { flexDirection: 'row', gap: 8 },
  urlInput: { flex: 1 },
  scanBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: C.card2,
  },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: C.text, fontSize: F.lg, fontWeight: '800', marginBottom: 12 },
  label: { color: C.faint, fontSize: F.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.text,
    fontSize: F.sm,
    fontFamily: 'monospace',
  },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  testBtn: {
    borderColor: C.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    flex: 1,
  },
  testText: { color: C.accentLight, fontSize: F.sm, fontWeight: '700' },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    flex: 2,
  },
  saveText: { color: '#fff', fontSize: F.sm, fontWeight: '700' },
  okText: { color: C.green, fontSize: F.xs, marginTop: 8, fontWeight: '600' },
  failText: { color: C.red, fontSize: F.xs, marginTop: 8, fontWeight: '600' },
  hintText: { color: C.amber, fontSize: F.xs, marginTop: 8, lineHeight: 17, fontWeight: '500' },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connText: { color: C.dim, fontSize: F.xs, flex: 1 },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    backgroundColor: C.card2,
  },
  serverText: { flex: 1, fontSize: F.xs, fontFamily: 'monospace' },
  shopName: { color: C.text, fontSize: F.md, fontWeight: '700' },
  meta: { color: C.faint, fontSize: F.xs, marginTop: 2 },
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
  logoutBtn: {
    borderColor: C.red,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: `${C.red}15`,
  },
  logoutText: { color: C.red, fontSize: F.sm, fontWeight: '700' },
  footer: { color: C.faint, fontSize: F.xs, textAlign: 'center', marginTop: 24 },
});
