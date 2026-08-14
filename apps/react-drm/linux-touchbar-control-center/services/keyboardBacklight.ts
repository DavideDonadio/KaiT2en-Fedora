import { execFile, execFileSync } from 'child_process';
import fs from 'fs';

// The T2 keyboard backlight is exposed by the t2hid driver as an LED whose
// name ends in "kbd_backlight" (e.g. ":white:kbd_backlight") under
// /sys/class/leds. Auto-detect it instead of hardcoding, so the control keeps
// working if the driver renames the LED or a machine exposes a differently
// named device.
function findKbdBacklightDevice(): string | null {
  try {
    return fs.readdirSync('/sys/class/leds').find(n => n.includes('kbd_backlight')) ?? null;
  } catch {
    return null;
  }
}

function brightnessctl(args: string[]): string | null {
  try {
    return execFileSync('brightnessctl', args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** Current keyboard backlight as a fraction of max (0..1), 0.5 if unknown. */
export function getKeyboardBacklightPercent(): number {
  const device = findKbdBacklightDevice();
  if (!device) return 0.5;
  const cur = brightnessctl(['--device', device, 'get']);
  const max = brightnessctl(['--device', device, 'max']);
  if (cur === null || max === null) return 0.5;
  const curN = parseInt(cur, 10);
  const maxN = parseInt(max, 10);
  return maxN > 0 ? Math.min(1, Math.max(0, curN / maxN)) : 0.5;
}

/** Set the keyboard backlight to a fraction of max (0..1). */
export function setKeyboardBacklightPercent(pct: number): void {
  const device = findKbdBacklightDevice();
  if (!device) return;
  const clamped = Math.max(0, Math.min(100, Math.round(pct * 100)));
  // brightnessctl talks to systemd-logind (SetBrightness) when the sysfs LED
  // is not directly writable by the session user, so this works without root
  // and without any desktop daemon (gsd/upower) being involved.
  execFile('brightnessctl', ['--device', device, 'set', `${clamped}%`], () => {});
}

/** Step the keyboard backlight by a delta given as a fraction of max. */
export function stepKeyboardBacklight(deltaPct: number): void {
  setKeyboardBacklightPercent(getKeyboardBacklightPercent() + deltaPct);
}
