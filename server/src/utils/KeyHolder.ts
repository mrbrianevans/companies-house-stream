/**
 * Almost like reference counting, or semaphores: this is to use 3 streaming API
 * keys to connect to all 6 streams at the same time, but each key can only be
 * used for 2 at a time. This class keeps track of how many are in use.
 */
class KeyHolder {
  keys: Record<string, number>
  maxUsages = 2

  constructor(maxUsages = 2) {
    this.maxUsages = maxUsages
    this.keys = {}
  }

  /**
   * Adds a new API key. This should be from an environment variable.
   * @example
   * keyHolder.addKey(process.env.STREAM_KEY);
   */
  addKey(key: string) {
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
export const restKeyHolder = new KeyHolder()
