/**
 * Almost like reference counting, or semaphores: this is to use 3 streaming API
 * keys to connect to all 6 streams at the same time, but each key can only be
 * used for 2 at a time. This class keeps track of how many are in use.
 */
class KeyHolder {
  keys: Set<string>;
  counter: Record<string, number>;
  maxUsages = 2;

  constructor(maxUsages = 2) {
    this.maxUsages = maxUsages;
    this.keys = new Set();
    this.counter = {};
  }

  addKey(key: string) {
    this.keys.add(key);
    this.counter[key] = 0;
  }

  removeKey(key: string) {
    this.keys.delete(key);
    delete this.counter[key];
  }

  /**
   * Request a key to use.
   */
  useKey(): string {
    if (this.keys.size === 0) throw new Error("Keys have not been added yet, but one was requested");
    // find a key being used less than the maximum allowed usages
    for (const key of this.keys) {
      if (this.counter[key] < this.maxUsages) {
        this.counter[key]++;
        return key;
      }
    }
    console.error("No key found");
    return this.keys.values()[0];
  }

  /**
   * Relinquish key
   */
  disuseKey(key: string) {
    this.counter[key]--;
  }
}

export const keyHolder = new KeyHolder();
