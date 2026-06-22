// Portrait store — maps dialogue speaker IDs to image URLs.
// Works with dialogueBox.ts: pass the store in opts and the box
// resolves speaker → portrait automatically, no per-node portrait field needed.
//
//   const portraits = createPortraitStore()
//   portraits.register('Warden Hayes', '/img/warden.jpg')
//   portraits.autoCanvas('UNIT-07', '#3a7cf7', 'U7')   // generates a colored avatar
//
//   const box = createDialogueBox(runner, { portraits })

export interface PortraitStore {
  /** Register a speaker id → image URL mapping. */
  register(speakerId: string, src: string): void
  /** Resolve a speaker id to its portrait URL, or undefined if unknown. */
  get(speakerId: string): string | undefined
  /** True if a portrait is registered for this speaker. */
  has(speakerId: string): boolean
  /** Remove a registration. Returns true if something was removed. */
  remove(speakerId: string): boolean
  /** All registered entries. */
  list(): Array<{ id: string; src: string }>
  /** Clear all registrations. */
  clear(): void
  /**
   * Generate a simple canvas avatar (colored circle + initials) as a data URL
   * and register it. No external assets required — great for prototyping.
   */
  autoCanvas(speakerId: string, color: string, initials?: string, size?: number): string
  /** Preload all registered images (returns after all loads settle). */
  preload(ids?: string[]): Promise<void>
}

export function createPortraitStore(): PortraitStore {
  const _map = new Map<string, string>()

  const store: PortraitStore = {
    register(id, src) { _map.set(id, src) },
    get(id)           { return _map.get(id) },
    has(id)           { return _map.has(id) },
    remove(id)        { return _map.delete(id) },
    list()            { return [..._map.entries()].map(([id, src]) => ({ id, src })) },
    clear()           { _map.clear() },

    autoCanvas(speakerId, color, initials = '', size = 80) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')!
      // Background circle
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.fill()
      // Subtle inner shadow ring
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = size * 0.06
      ctx.stroke()
      // Initials text
      if (initials) {
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.round(size * 0.36)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initials.slice(0, 3), size / 2, size / 2 + 1)
      }
      const url = canvas.toDataURL()
      _map.set(speakerId, url)
      return url
    },

    async preload(ids?) {
      const toLoad = ids ? ids.map(id => _map.get(id)).filter(Boolean) as string[]
                        : [..._map.values()]
      await Promise.allSettled(
        toLoad.map(src => new Promise<void>((res, rej) => {
          const img = new Image()
          img.onload  = () => res()
          img.onerror = () => rej(new Error(`Portrait failed: ${src}`))
          img.src = src
        }))
      )
    },
  }

  return store
}
