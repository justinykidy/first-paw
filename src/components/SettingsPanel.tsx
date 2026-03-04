import { storage } from '../utils/storage';

// Persisted settings controls for sound and camera angle.
interface SettingsPanelProps {
  soundEnabled: boolean;
  cameraAngle: 'white' | 'black' | 'top';
  onSoundEnabledChange: (enabled: boolean) => void;
  onCameraAngleChange: (angle: 'white' | 'black' | 'top') => void;
}

export function SettingsPanel({
  soundEnabled,
  cameraAngle,
  onSoundEnabledChange,
  onCameraAngleChange,
}: SettingsPanelProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Settings</h2>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Sound</span>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            storage.updateSettings({ soundEnabled: enabled });
            onSoundEnabledChange(enabled);
          }}
        />
      </label>

      <label className="block text-sm">
        Camera
        <select
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
          value={cameraAngle}
          onChange={(event) => {
            const angle = event.target.value as 'white' | 'black' | 'top';
            storage.updateSettings({ cameraAngle: angle });
            onCameraAngleChange(angle);
          }}
        >
          <option value="white">White Side</option>
          <option value="black">Black Side</option>
          <option value="top">Top View</option>
        </select>
      </label>
    </section>
  );
}
