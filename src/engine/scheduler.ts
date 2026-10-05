/** Discrete events, not wall-clock timers. Each callback runs to completion. */
export class Scheduler {
  now = 0
  private sequence = 0
  private queue: { at: number; sequence: number; action: () => void }[] = []
  at(at: number, action: () => void) {
    if (at < this.now || !Number.isFinite(at)) throw new Error('Invalid event time')
    this.queue.push({ at, sequence: this.sequence++, action })
  }
  after(delay: number, action: () => void) {
    this.at(this.now + delay, action)
  }
  run() {
    let budget = 10000
    while (this.queue.length) {
      if (--budget === 0) throw new Error('Simulation event budget exhausted')
      this.queue.sort((a, b) => a.at - b.at || a.sequence - b.sequence)
      const next = this.queue.shift()!
      this.now = next.at
      next.action()
    }
  }
}
