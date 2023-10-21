/**
 * This class is used to hold keys (usually from environment variables) and keep track of how many times each one is used.
 */
class KeyHolder {
  keys: Record<string, number>
  maxUsages: number

  constructor(maxUsages = 7) {
    this.maxUsages = maxUsages
    this.keys = {}
  }

  /**
   * Adds a new API key. This should be from an environment variable.
   * @example
   * keyHolder.addKey(process.env.STREAM_KEY);
   */
  addKey(key?: string) {
    if (!key) throw new Error("Attempted to add empty key to KeyHolder")
    this.keys[key] = 0
  }

  /**
   * Remove a key to prevent this key from being issued again.
   */
  removeKey(key: string) {
    delete this.keys[key]
  }

  /**
   * Request a key to use.
   */
  useKey(): string {
    if (Object.entries(this.keys).length === 0) throw new Error("Keys have not been added yet, but one was requested")
    // find a key being used less than the maximum allowed usages
    for (const [key, usageCount] of Object.entries(this.keys)) {
      if (usageCount < this.maxUsages) {
        this.keys[key]++
        return key
      }
    }
    console.error("No key found, issuing first key")
    return Object.keys(this.keys)[0]
  }

  /**
   * Relinquish key when no longer in use.
   */
  disuseKey(key: string) {
    this.keys[key]--
  }

  keyCount() {
    return Object.keys(this.keys).length
  }
}

// singleton KeyHolder to be accessed by different files in application
export const streamKeyHolder = new KeyHolder()
