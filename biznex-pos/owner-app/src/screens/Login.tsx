import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoMark from '../../assets/logo-mark.png';
import { User, getServerUrl, login, setServerUrl, discoverServer, ORIGINAL_SERVER, NGROK_URL, getStartupErrors } from '../api';
import ScanQr from './ScanQr';
import { C, F } from '../theme';

export default function Login({ onLogin, startupErrors }: { onLogin: (user: User) => void; startupErrors?: string[] }) {
  const [serverUrl, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [detected, setDetected] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [bootErrors, setBootErrors] = useState<string[]>([]);

  // Show only startup errors recorded in the last 10 minutes — a debugging
  // aid if the app ever fails to boot on a device.
  React.useEffect(() => {
    getStartupErrors().then((errs) => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      const recent = errs.filter((e) => {
        const ts = new Date(e.slice(0, 24)).getTime();
        return !Number.isNaN(ts) && ts >= cutoff;
      });
      if (recent.length > 0) setBootErrors(recent);
    });
  }, []);

  // Auto-detect the store: probe the saved address, the original LAN IP and the
  // ngrok tunnel, then prefill the best one that answers.
  React.useEffect(() => {
    (async () => {
      const saved = await getServerUrl();
      if (saved) {
        setUrl(saved);
        setDetecting(false);
      }
      const found = await discoverServer();
      if (found) {
        setUrl(found);
        setDetected(true);
      }
      setDetecting(false);
    })();
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const user = await login(serverUrl.trim(), username.trim(), password);
      onLogin(user);
    } catch (e: any) {
      setError(e?.message || 'Could not connect. Check the server address and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <View pointerEvents="none" style={s.glowTop} />
      <View pointerEvents="none" style={s.glowBottom} />

      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={[s.logo, s.logoWhite]}>
            <Image source={LogoMark} style={s.logoImage} resizeMode="contain" />
          </View>
          <Text style={s.title}>Biznex Owner</Text>
          <Text style={s.subtitle}>Your store, in your pocket</Text>

          <View style={s.form}>
            {bootErrors.length > 0 && (
              <View style={s.errorBox}>
                <Ionicons name="bug-outline" size={16} color={C.amber} />
                <Text style={s.errorText}>
                  Startup logged an issue: {bootErrors[0]}
                </Text>
              </View>
            )}
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={C.red} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={s.label}>Store server address</Text>
            <View style={s.urlRow}>
              <View style={s.inputShell}>
                <Ionicons name="server-outline" size={16} color={C.faint} />
                <TextInput
                  style={s.input}
                  value={serverUrl}
                  onChangeText={(t) => { setUrl(t); setScanNote(''); setDetected(false); }}
                  placeholder="http://192.168.1.100:3000"
                  placeholderTextColor={C.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <TouchableOpacity style={s.scanBtn} onPress={() => setScanning(true)} activeOpacity={0.8}>
                <Ionicons name="qr-code-outline" size={22} color={C.accentLight} />
              </TouchableOpacity>
            </View>
            {detecting ? <Text style={s.detectNote}>🔎 Looking for your store…</Text> : null}
            {!detecting && detected ? <Text style={s.detectNote}>✓ Store found — address filled in automatically</Text> : null}
            {!detecting && !detected && serverUrl ? <Text style={s.detectNote}>Store not found on this network yet — you can still connect via QR or the address above (ngrok works from anywhere).</Text> : null}
            {scanNote ? <Text style={s.scanNote}>✓ {scanNote}</Text> : null}

            <Text style={s.label}>Username</Text>
            <View style={s.inputShell}>
              <Ionicons name="person-outline" size={16} color={C.faint} />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="admin"
                placeholderTextColor={C.faint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputShell}>
              <Ionicons name="lock-closed-outline" size={16} color={C.faint} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.faint}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={10} activeOpacity={0.7}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.faint} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.connectBtn, (busy || !username || !password) && { opacity: 0.6 }]}
              onPress={submit}
              disabled={busy || !username || !password}
              activeOpacity={0.85}
            >
              {busy ? (
                <Text style={s.connectText}>Connecting…</Text>
              ) : (
                <>
                  <Ionicons name="link-outline" size={18} color="#fff" />
                  <Text style={s.connectText}>Connect to store</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.qrRow} onPress={() => setScanning(true)} activeOpacity={0.7}>
              <Ionicons name="qr-code-outline" size={18} color={C.accentLight} />
              <Text style={s.qrText}>Scan the QR on the store's screen</Text>
            </TouchableOpacity>

            <Text style={s.hint}>
              Same Wi-Fi: use the Pi's LAN IP · Anywhere: use its Tailscale or ngrok address
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {scanning && (
        <ScanQr
          onFound={(url) => {
            setUrl(url);
            setScanNote(`Address set from QR: ${url}`);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(99,102,241,0.16)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 48 },
  logoWhite: { backgroundColor: '#ffffff' },
  logoImage: { width: 56, height: 48 },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignSelf: 'center',
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  title: { color: C.text, fontSize: F.xl, fontWeight: '800', textAlign: 'center', marginTop: 18 },
  subtitle: { color: C.faint, fontSize: F.sm, textAlign: 'center', marginTop: 4, marginBottom: 26 },
  form: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  label: {
    color: C.faint,
    fontSize: F.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  urlRow: { flexDirection: 'row', gap: 8 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  input: { flex: 1, paddingVertical: 12, color: C.text, fontSize: F.md },
  scanBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: C.card2,
  },
  scanNote: { color: C.green, fontSize: F.xs, marginTop: 8, fontWeight: '600' },
  detectNote: { color: C.dim, fontSize: F.xs, marginTop: 8, lineHeight: 16 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: C.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  connectText: { color: '#fff', fontSize: F.md, fontWeight: '700' },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
  },
  qrText: { color: C.accentLight, fontSize: F.sm, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${C.red}15`,
    borderColor: `${C.red}40`,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 2,
  },
  errorText: { color: C.red, fontSize: F.xs, flex: 1, lineHeight: 16 },
  hint: { color: C.faint, fontSize: F.xs, marginTop: 14, lineHeight: 16, textAlign: 'center' },
});
