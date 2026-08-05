export class Telescope {
  constructor() {
    this.raised = false
    this.power = null
    this.focus = 0
  }

  setRaised(raised) {
    this.raised = raised
    if (!raised) this.focus = 0
  }

  unlock(power) {
    this.power = power
  }

  update(isFocused, delta) {
    if (this.raised && isFocused) this.focus = Math.min(1, this.focus + delta / 2.6)
    else if (!this.raised) this.focus = 0
    return this.focus
  }
}