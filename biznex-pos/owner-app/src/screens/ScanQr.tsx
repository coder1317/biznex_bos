import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StatusBar as RNStatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { parsePairPayload } from '../api';
import { C, F } from '../theme';

const FRAME = 230;

/**
 * Full-screen QR scanner. Rendered inside a native Modal so it always covers
 * the whole screen (on Login and in Settings). Detects the pairing code printed
 * on the store's Settings screen and hands the server address back via `onFound`.
 */
export default function ScanQr({ onFound, onClose }: { onFound: (url: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: FRAME - 16, duration: 1900, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanY]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    const url = parsePairPayload(data);
    if (!url) return; // not a pairing code — keep scanning
    setScanned(true);
    onFound(url);
  };

  const topInset = (RNStatusBar.currentHeight || 0) + 8;

  let body: React.ReactNode;
  if (!permission) {
    body = (
      <View style={s.center}>
        <Text style={s.title}>Starting camera…</Text>
      </View>
    );
  } else if (!permission.granted) {
    body = (
      <View style={s.center}>
        <View style={s.iconCircle}>
          <Ionicons name="camera-outline" size={34} color={C.accentLight} />
        </View>
        <Text style={s.title}>Camera permission needed</Text>
        <Text style={s.sub}>Allow camera access so you can scan the QR code on the store's screen.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Grant permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} onPress={onClose}>
          <Text style={s.ghostText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />

        {/* Dimmed area around the scan frame */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={s.dim} />
          <View style={{ flexDirection: 'row', height: FRAME }}>
            <View style={s.dim} />
            <View style={{ width: FRAME }} />
            <View style={s.dim} />
          </View>
          <View style={s.dim} />
        </View>

        {/* Corner frame — dead center, aligned with the dim hole */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={s.frameWrap}>
            <View style={{ width: FRAME, height: FRAME }}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
              <Animated.View style={[s.scanLine, { transform: [{ translateY: scanY }] }]} />
            </View>
          </View>
        </View>

        {/* Hint */}
        <View pointerEvents="none" style={s.hintWrap}>
          {scanned ? (
            <Text style={s.done}>Got it ✓</Text>
          ) : (
            <Text style={s.hint}>Point at the QR code on the store's screen</Text>
          )}
        </View>

        {/* Close */}
        <TouchableOpacity style={[s.close, { top: topInset }]} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root}>{body}</View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#0b0e15', alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.card2,
    borderColor: C.border2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: F.lg, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  sub: { color: C.dim, fontSize: F.sm, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 34, marginTop: 22 },
  btnText: { color: '#fff', fontSize: F.sm, fontWeight: '700' },
  ghost: { marginTop: 14, padding: 10 },
  ghostText: { color: C.faint, fontSize: F.sm, fontWeight: '600' },

  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: C.accentLight },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: C.accentLight,
    shadowColor: C.accentLight,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  hintWrap: { position: 'absolute', bottom: 110, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 30 },
  hint: { color: '#fff', fontSize: F.sm, fontWeight: '600', textAlign: 'center', opacity: 0.95 },
  done: { color: C.green, fontSize: F.lg, fontWeight: '800' },
  close: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
