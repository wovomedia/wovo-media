import { execFileSync } from 'node:child_process';
const version = execFileSync('xcodebuild', ['-version'], { encoding: 'utf8' });
const major = Number(/^Xcode (\d+)/m.exec(version)?.[1] ?? 0);
if (major < 26) throw new Error('Capacitor 8 requires Xcode 26 or newer. Select an installed supported Xcode.');
