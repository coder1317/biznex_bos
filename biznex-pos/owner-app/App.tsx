import React, { Component, ReactNode, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getConnState,
  getStoredUser,
  getToken,
  startRealtime,
  stopRealtime,
  startHealthMonitor,
  stopHealthMonitor,
  subscribeConn,
  autoConnect,
  recordStartupError,
  ConnState,
} from './src/api';
import { hydrateCache, clearAllCache } from './src/store';
import { startSync, stopSync } from './src/sync';
import { C, F } from './src/theme';

// Keep the native splash visible until the icon font is ready — otherwise
// screens render before the font loads and every icon shows up blank.
// The call is wrapped so a missing/broken native splash module can never
// block startup (which would show a black screen on device).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Hard ceiling on the native splash: whatever happens (font slow, storage
// slow, network probing), force it away after a few seconds so the app always
// becomes interactive. A stuck splash is a black screen on device.
function hideSplashSoon(ms = 4000) {
  setTimeout(() => SplashScreen.hideAsync().catch(() => {}), ms);
}

// If anything crashes at startup, show a readable screen instead of a white one.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.crash}>
          <Text style={s.crashTitle}>Something went wrong</Text>
          <Text style={s.crashMsg}>{String(this.state.error.message || this.state.error)}</Text>
          <TouchableOpacity style={s.crashBtn} onPress={() => this.setState({ error: null })}>
            <Text style={s.crashBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Log uncaught JS errors instead of silently white-screening.
const g = globalThis as any;
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler && g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error('Uncaught JS error' + (isFatal ? ' (fatal)' : ''), error);
    if (prev) prev(error, isFatal);
  });
}
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Orders from './src/screens/Orders';
import Inventory from './src/screens/Inventory';
import Staff from './src/screens/Staff';
import Complaints from './src/screens/Complaints';
import Settings from './src/screens/Settings';

type Tab = 'dashboard' | 'orders' | 'inventory' | 'staff' | 'complaints' | 'settings';

// Minimum role required to see each tab (owner > admin > manager > cashier),
// matching the store server's role model.
const ROLE_LEVEL = { owner: 4, admin: 3, manager: 2, cashier: 1 } as const;
type Role = keyof typeof ROLE_LEVEL;

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap; role: Role }[] = [
  { key: 'dashboard', label: 'Home', icon: 'home-outline', active: 'home', role: 'cashier' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline', active: 'receipt', role: 'cashier' },
  { key: 'inventory', label: 'Stock', icon: 'cube-outline', active: 'cube', role: 'manager' },
  { key: 'staff', label: 'Staff', icon: 'people-outline', active: 'people', role: 'admin' },
  { key: 'complaints', label: 'Issues', icon: 'chatbubble-ellipses-outline', active: 'chatbubble-ellipses', role: 'manager' },
];

export default function App() {
  // `fontError` is tolerated: if the icon font can't load we still render the
  // app (icons may show as boxes, but the screen is never black).
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const fontsReady = !!fontsLoaded || !!fontError;
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>('cashier');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [conn, setConn] = useState<ConnState>(getConnState());
  const [autoFailed, setAutoFailed] = useState(false);

  // Viewer-first launch: discover the store server and restore the last
  // session automatically. Only if that fails (no saved session, or the store
  // is unreachable) do we fall back to the login screen. The whole body is
  // guarded so an unexpected error can never leave `ready` unset (black
  // screen) — worst case we land on the login screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load the persisted local store first (fire-and-forget) so screens
        // render last-known data instantly — even before any network sync.
        hydrateCache();
        const [token, user] = await Promise.all([getToken(), getStoredUser()]);
        if (cancelled) return;
        if (token && user) {
          setLoggedIn(true);
          if (user?.role) setRole(user.role as Role);
        } else {
          const session = await autoConnect();
          if (cancelled) return;
          if (session) {
            setLoggedIn(true);
            if (session.user?.role) setRole(session.user.role as Role);
          } else {
            setAutoFailed(true);
          }
        }
      } catch (e: any) {
        // Never block startup on an unexpected error — show login and keep a
        // record of what happened so it can be debugged on-device.
        recordStartupError(String(e?.message || e));
        setAutoFailed(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the native splash as soon as we can render (and hard-force it after
  // a few seconds regardless, so a slow font can't leave a black screen).
  useEffect(() => {
    if (ready && fontsReady) SplashScreen.hideAsync().catch(() => {});
    hideSplashSoon();
  }, [ready, fontsReady]);

  // Tabs the signed-in role is allowed to see.
  const visibleTabs = TABS.filter((t) => (ROLE_LEVEL[role] ?? 0) >= ROLE_LEVEL[t.role]);

  // If the current tab is no longer allowed (e.g. the user role changed after
  // sign-in), fall back to a tab the user can see. 'settings' (the More tab) is
  // always available.
  const activeTab: Tab = tab === 'settings' || visibleTabs.some((t) => t.key === tab) ? tab : 'dashboard';

  // Keep the live socket to the Pi connected for as long as we're signed in,
  // on every tab — and surface its status so the UI can show online/offline.
  // The failover monitor keeps the connection strong: if the current server
  // drops, it re-discovers (LAN IP / ngrok) and switches automatically.
  // The sync engine pulls stats through the tunnel in the background and
  // writes them to the local store — screens never fetch on their own.
  useEffect(() => {
    if (loggedIn) {
      startRealtime();
      startHealthMonitor();
      startSync();
    } else {
      stopRealtime();
      stopHealthMonitor();
      stopSync();
      clearAllCache();
    }
  }, [loggedIn]);

  useEffect(() => subscribeConn(setConn), []);

  // While booting, always render a visible branded splash — never `null`
  // (which would be a black screen on device). The ErrorBoundary wraps
  // everything, including login, so no crash can blank the screen.
  if (!ready) {
    return (
      <ErrorBoundary>
        <StatusBar style="light" />
        <View style={s.splash}>
          <View style={s.logo}>
            <Text style={s.logoText}>B</Text>
          </View>
          <Text style={s.splashTitle}>Biznex Owner</Text>
          <Text style={s.splashSub}>Starting…</Text>
        </View>
      </ErrorBoundary>
    );
  }

  if (!loggedIn) {
    return (
      <ErrorBoundary>
        <StatusBar style="light" />
        {autoFailed ? (
          <Login
            startupErrors={[]}
            onLogin={(user) => {
              setLoggedIn(true);
              if (user?.role) setRole(user.role as Role);
            }}
          />
        ) : (
          <View style={s.splash}>
            <View style={s.logo}>
              <Text style={s.logoText}>B</Text>
            </View>
            <Text style={s.splashTitle}>Biznex Owner</Text>
            <Text style={s.splashSub}>Finding your store and restoring session…</Text>
          </View>
        )}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View style={s.root}>
        <StatusBar style="light" />
        <SafeAreaView style={s.safe} edges={['top']}>
          {conn !== 'online' && (
            <TouchableOpacity
              style={conn === 'offline' ? s.offlineBar : s.connectingBar}
              onPress={() => setTab('settings')}
              activeOpacity={0.9}
            >
              <Ionicons name={conn === 'offline' ? 'cloud-offline-outline' : 'sync-outline'} size={15} color="#fff" />
              <Text style={s.barText}>
                {conn === 'offline' ? "Can't reach the store server — tap to change address" : 'Connecting to store…'}
              </Text>
              <Text style={s.barAction}>Fix</Text>
            </TouchableOpacity>
          )}
          <View style={s.content}>
            {activeTab === 'dashboard' && <Dashboard onOpenSettings={() => setTab('settings')} />}
            {activeTab === 'orders' && <Orders />}
            {activeTab === 'inventory' && <Inventory />}
            {activeTab === 'staff' && <Staff />}
            {activeTab === 'complaints' && <Complaints />}
            {activeTab === 'settings' && <Settings onLogout={() => setLoggedIn(false)} />}
          </View>

          <View style={s.tabBar}>
            {visibleTabs.map((t) => (
              <TouchableOpacity key={t.key} style={s.tab} onPress={() => setTab(t.key)} activeOpacity={0.7}>
                <Ionicons
                  name={activeTab === t.key ? t.active : t.icon}
                  size={22}
                  color={activeTab === t.key ? C.accentLight : C.faint}
                />
                <Text style={[s.tabLabel, { color: activeTab === t.key ? C.accentLight : C.faint }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            {visibleTabs.some((t) => t.key === 'settings') ? null : (
              <TouchableOpacity style={s.tab} onPress={() => setTab('settings')} activeOpacity={0.7}>
                <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={22} color={activeTab === 'settings' ? C.accentLight : C.faint} />
                <Text style={[s.tabLabel, { color: activeTab === 'settings' ? C.accentLight : C.faint }]}>More</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  content: { flex: 1 },
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  splashTitle: { color: C.text, fontSize: F.lg, fontWeight: '800', marginTop: 18 },
  splashSub: { color: C.dim, fontSize: F.sm, marginTop: 6, textAlign: 'center' },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amber,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  barText: { color: '#fff', fontSize: F.xs, fontWeight: '600', flex: 1 },
  barAction: { color: '#fff', fontSize: F.xs, fontWeight: '800', textDecorationLine: 'underline' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  crash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  crashTitle: { color: C.text, fontSize: F.lg, fontWeight: '800' },
  crashMsg: { color: C.dim, fontSize: F.sm, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  crashBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 20,
  },
  crashBtnText: { color: '#fff', fontSize: F.sm, fontWeight: '700' },
});
