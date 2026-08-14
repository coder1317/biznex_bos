#!/usr/bin/env node
/**
 * Patches expo-modules-core's Android gradle plugin with the upstream fix for:
 *   "Could not get unknown property 'release' for SoftwareComponent container"
 *
 * Background: the installed expo-modules-core (SDK 52, 2.2.x) always registers
 * a `publishing { release(MavenPublication) { from components.release } }` block,
 * which crashes during configuration on some AGP setups (Gradle 8.10 + AGP 8.6).
 * Upstream expo added a guard that skips publishing when the `release` component
 * is not available — harmless, since nothing consumes the mavenLocal artifact
 * during a normal debug/release APK build.
 *
 * This runs automatically via the `postinstall` script, so `npm install`
 * always applies it. It is idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle'
);

if (!fs.existsSync(pluginPath)) {
  console.log('  • expo-modules-core plugin not found — skipping patch');
  process.exit(0);
}

const source = fs.readFileSync(pluginPath, 'utf8');

if (source.includes('components.findByName("release") == null')) {
  console.log('  ✓ expo-modules-core publishing patch already applied');
  process.exit(0);
}

const guard = `  if (components.findByName("release") == null) {
    return
  }
`;

// Insert the guard right after the maven-publish apply block inside useExpoPublishing
const needle = `  if (!project.plugins.hasPlugin('maven-publish')) {
    apply plugin: 'maven-publish'
  }
`;
if (!source.includes(needle)) {
  console.error('  ✗ Could not locate the maven-publish block — patch aborted (no change made)');
  process.exit(1);
}

const patched = source.replace(needle, needle + '\n' + guard);
fs.writeFileSync(pluginPath, patched);
console.log('  ✓ Patched expo-modules-core publishing guard (components.release fix)');
