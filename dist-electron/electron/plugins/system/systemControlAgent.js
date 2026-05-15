/**
 * System Control Agent — Phase 3
 *
 * Controls Windows system settings:
 *   - Volume (mute/set/increase/decrease)
 *   - Brightness
 *   - Screenshot (Electron desktopCapturer or keyboard)
 *   - Lock screen
 *   - Power (sleep/shutdown/restart)
 *   - WiFi toggle
 *   - Bluetooth toggle
 *   - Clipboard read/clear
 *   - Recycle Bin empty (delegated to fileSystemAgent)
 */
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
const execAsync = promisify(exec);
// ─── Volume ───────────────────────────────────────────────────────────────────
/** Toggle mute via VK_VOLUME_MUTE key send */
export async function volumeMute() {
    try {
        const ps = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]173)`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 5_000 });
        return { ok: true, message: 'Volume muted/unmuted.' };
    }
    catch (err) {
        return { ok: false, message: `Mute failed: ${String(err).slice(0, 120)}` };
    }
}
/** Set volume to an exact level 0-100 via PowerShell Windows Audio API */
export async function volumeSet(level) {
    const clamped = Math.max(0, Math.min(100, level));
    try {
        const ps = `
$vol = ${clamped / 100}
$code = @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume{
  int r0();int r1();int r2();int r3();
  int SetMasterVolumeLevelScalar(float f,System.Guid g);
  int r5();int GetMasterVolumeLevelScalar(out float f);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice{int Activate(ref System.Guid id,int ctx,int p,[MarshalAs(UnmanagedType.IUnknown)]out object o);}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator{int r();int GetDefaultAudioEndpoint(int d,int r,out IMMDevice e);}
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumeratorCo{}
public class VolCtrl{
  public static void Set(float v){
    var e=new MMDeviceEnumeratorCo() as IMMDeviceEnumerator;
    IMMDevice d=null; e.GetDefaultAudioEndpoint(0,1,out d);
    object o=null; var g=typeof(IAudioEndpointVolume).GUID;
    d.Activate(ref g,23,0,out o);
    ((IAudioEndpointVolume)o).SetMasterVolumeLevelScalar(v,System.Guid.Empty);
  }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[VolCtrl]::Set($vol)
`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, '; ').replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 10_000 });
        return { ok: true, message: `Volume set to ${clamped}%.` };
    }
    catch {
        // Fallback: use WScript key simulation
        try {
            const ps2 = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]174)`;
            await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps2}"`, { windowsHide: true });
            return { ok: true, message: `Volume adjusted (fallback).` };
        }
        catch (err2) {
            return { ok: false, message: `Volume set failed: ${String(err2).slice(0, 120)}` };
        }
    }
}
/** Increase volume by N steps (each step = one VK_VOLUME_UP key) */
export async function volumeIncrease(steps = 5) {
    try {
        const repeats = Math.min(steps, 20);
        const ps = `$wsh = New-Object -ComObject WScript.Shell; 1..${repeats} | ForEach-Object { $wsh.SendKeys([char]175) }`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 8_000 });
        return { ok: true, message: `Volume increased by ${repeats} steps.` };
    }
    catch (err) {
        return { ok: false, message: `Volume increase failed: ${String(err).slice(0, 120)}` };
    }
}
/** Decrease volume by N steps */
export async function volumeDecrease(steps = 5) {
    try {
        const repeats = Math.min(steps, 20);
        const ps = `$wsh = New-Object -ComObject WScript.Shell; 1..${repeats} | ForEach-Object { $wsh.SendKeys([char]174) }`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 8_000 });
        return { ok: true, message: `Volume decreased by ${repeats} steps.` };
    }
    catch (err) {
        return { ok: false, message: `Volume decrease failed: ${String(err).slice(0, 120)}` };
    }
}
// ─── Brightness ───────────────────────────────────────────────────────────────
export async function setBrightness(level) {
    const clamped = Math.max(0, Math.min(100, level));
    try {
        const ps = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1, ${clamped})`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 8_000 });
        return { ok: true, message: `Brightness set to ${clamped}%.` };
    }
    catch (err) {
        return { ok: false, message: `Brightness change failed (may not be supported on desktop monitors): ${String(err).slice(0, 120)}` };
    }
}
// ─── Screenshot ───────────────────────────────────────────────────────────────
/** Take a screenshot by sending Print Screen key and saving to Desktop. */
export async function takeScreenshot() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const savePath = path.join(os.homedir(), 'Desktop', `screenshot-${timestamp}.png`);
        const ps = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$g.Dispose()
$bmp.Save('${savePath.replace(/\\/g, '\\\\')}')
$bmp.Dispose()
Write-Output "saved"
`;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, '; ')}"`, { windowsHide: true, timeout: 15_000 });
        if (stdout.includes('saved')) {
            return { ok: true, message: `Screenshot saved to Desktop as screenshot-${timestamp}.png.`, data: { path: savePath } };
        }
        return { ok: false, message: 'Screenshot could not be saved.' };
    }
    catch (err) {
        return { ok: false, message: `Screenshot failed: ${String(err).slice(0, 160)}` };
    }
}
// ─── Screen Lock ──────────────────────────────────────────────────────────────
export async function lockScreen() {
    try {
        spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { detached: true, stdio: 'ignore' }).unref();
        return { ok: true, message: 'Screen locked.' };
    }
    catch (err) {
        return { ok: false, message: `Lock failed: ${String(err).slice(0, 120)}` };
    }
}
// ─── Power ────────────────────────────────────────────────────────────────────
/** Shutdown (5 second delay to let Electron emit response first). */
export async function shutdownPC(delaySec = 5) {
    try {
        spawn('cmd', ['/c', `shutdown /s /t ${delaySec} /c "Jarvis initiated shutdown"`], {
            detached: true, stdio: 'ignore',
        }).unref();
        return { ok: true, message: `Shutdown initiated. PC will power off in ${delaySec} seconds.` };
    }
    catch (err) {
        return { ok: false, message: `Shutdown failed: ${String(err).slice(0, 120)}` };
    }
}
export async function restartPC(delaySec = 5) {
    try {
        spawn('cmd', ['/c', `shutdown /r /t ${delaySec} /c "Jarvis initiated restart"`], {
            detached: true, stdio: 'ignore',
        }).unref();
        return { ok: true, message: `Restart initiated. PC will restart in ${delaySec} seconds.` };
    }
    catch (err) {
        return { ok: false, message: `Restart failed: ${String(err).slice(0, 120)}` };
    }
}
export async function sleepPC() {
    try {
        spawn('rundll32.exe', ['powrprof.dll,SetSuspendState', '0', '1', '0'], {
            detached: true, stdio: 'ignore',
        }).unref();
        return { ok: true, message: 'Putting PC to sleep.' };
    }
    catch (err) {
        return { ok: false, message: `Sleep failed: ${String(err).slice(0, 120)}` };
    }
}
/** Cancel a pending shutdown/restart. */
export async function cancelShutdown() {
    try {
        await execAsync('cmd /c shutdown /a', { windowsHide: true, timeout: 5_000 });
        return { ok: true, message: 'Shutdown/restart cancelled.' };
    }
    catch {
        return { ok: false, message: 'No pending shutdown to cancel.' };
    }
}
// ─── WiFi ─────────────────────────────────────────────────────────────────────
export async function setWifi(on) {
    try {
        // Get the first available WLAN profile
        const { stdout: profileOut } = await execAsync('netsh wlan show profiles', { windowsHide: true, timeout: 8_000 });
        const match = profileOut.match(/All User Profile\s*:\s*(.+)/i);
        if (!match) {
            if (!on) {
                await execAsync('netsh interface set interface "Wi-Fi" disable', { windowsHide: true, timeout: 8_000 });
                return { ok: true, message: 'Wi-Fi disabled.' };
            }
            await execAsync('netsh interface set interface "Wi-Fi" enable', { windowsHide: true, timeout: 8_000 });
            return { ok: true, message: 'Wi-Fi enabled.' };
        }
        const profile = match[1].trim();
        if (on) {
            await execAsync(`netsh wlan connect name="${profile}"`, { windowsHide: true, timeout: 10_000 });
            return { ok: true, message: `Connected to Wi-Fi profile "${profile}".` };
        }
        await execAsync('netsh wlan disconnect', { windowsHide: true, timeout: 8_000 });
        return { ok: true, message: 'Wi-Fi disconnected.' };
    }
    catch (err) {
        return { ok: false, message: `Wi-Fi control failed: ${String(err).slice(0, 160)}` };
    }
}
// ─── Bluetooth ────────────────────────────────────────────────────────────────
export async function setBluetooth(on) {
    try {
        const ps = `
$bt = Get-PnpDevice | Where-Object { $_.FriendlyName -like '*Bluetooth*' -and $_.Class -eq 'Bluetooth' } | Select-Object -First 1
if ($bt) {
  if (${on ? '$true' : '$false'}) { Enable-PnpDevice -InstanceId $bt.InstanceId -Confirm:$false }
  else { Disable-PnpDevice -InstanceId $bt.InstanceId -Confirm:$false }
  Write-Output "ok"
} else { Write-Output "not_found" }
`;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, '; ')}"`, { windowsHide: true, timeout: 12_000 });
        if (stdout.includes('not_found'))
            return { ok: false, message: 'Bluetooth device not found.' };
        return { ok: true, message: `Bluetooth ${on ? 'enabled' : 'disabled'}.` };
    }
    catch (err) {
        return { ok: false, message: `Bluetooth control failed: ${String(err).slice(0, 160)}` };
    }
}
// ─── Clipboard ────────────────────────────────────────────────────────────────
export async function getClipboard() {
    try {
        const ps = `Get-Clipboard`;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 5_000 });
        return { ok: true, message: `Clipboard: "${stdout.trim().slice(0, 300)}"`, data: stdout.trim() };
    }
    catch (err) {
        return { ok: false, message: `Could not read clipboard: ${String(err).slice(0, 120)}` };
    }
}
export async function clearClipboard() {
    try {
        const ps = `Set-Clipboard -Value ''`;
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 5_000 });
        return { ok: true, message: 'Clipboard cleared.' };
    }
    catch (err) {
        return { ok: false, message: `Could not clear clipboard: ${String(err).slice(0, 120)}` };
    }
}
