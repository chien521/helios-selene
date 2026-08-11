// Sustained-focus duration to fill the scope, in seconds. Ramps from MIN near the chapter's
// start to MAX near its end -- the doc calls for hold time to track the color-grade progress
// "doubling as a difficulty curve," so later focus checks demand a longer hold than earlier ones.
const MIN_FOCUS_SECONDS = 1.8
const MAX_FOCUS_SECONDS = 3.6

export class Telescope {
  constructor() {
    this.raised = false
    this.aimUnlocked = false
    this.power = null
    this.focus = 0
  }

  setRaised(raised) {
    this.raised = raised
    if (!raised) this.focus = 0
  }

  unlock(power) {
    this.aimUnlocked = true
    this.power = power
  }

  unlockAim() {
    this.aimUnlocked = true
  }

  resetPower() {
    this.aimUnlocked = false
    this.power = null
    this.setRaised(false)
  }

  update(isFocused, delta, progress = 0) {
    if (this.raised && isFocused) {
      const duration = MIN_FOCUS_SECONDS + (MAX_FOCUS_SECONDS - MIN_FOCUS_SECONDS) * Math.min(1, Math.max(0, progress))
      this.focus = Math.min(1, this.focus + delta / duration)
    } else if (!this.raised) this.focus = 0
    return this.focus
  }
}