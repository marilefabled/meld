// Persisted user preferences — SFX and music volume.
// Loaded once at module init, auto-saved on every write.

const KEY = 'meld_settings_v1'

interface SettingsData {
  sfxVolume:   number
  musicVolume: number
}

function loadData(): SettingsData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { sfxVolume: 0.8, musicVolume: 0.45, ...JSON.parse(raw) }
  } catch {}
  return { sfxVolume: 0.8, musicVolume: 0.45 }
}

const _d = loadData()

function _save() {
  try { localStorage.setItem(KEY, JSON.stringify({ sfxVolume: _d.sfxVolume, musicVolume: _d.musicVolume })) } catch {}
}

export const settings = {
  get sfxVolume()    { return _d.sfxVolume },
  set sfxVolume(v)   { _d.sfxVolume   = Math.max(0, Math.min(1, v)); _save() },
  get musicVolume()  { return _d.musicVolume },
  set musicVolume(v) { _d.musicVolume = Math.max(0, Math.min(1, v)); _save() },
}
