const KEY = 'coreliv.accessToken'

/** Minimal persisted token store. Swappable when a real auth provider lands. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string | null): void {
    try {
      if (token) localStorage.setItem(KEY, token)
      else localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable */
    }
  },
}
