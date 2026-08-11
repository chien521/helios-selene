// The telescope's state, not a timer. An earlier version carried a MIN/MAX focus-duration ramp
// that scaled how long the player had to hold a button as the level progressed, on the theory that
// hold time "doubles as a difficulty curve". It does not: duration is only difficulty when
// something can go wrong during it, and nothing could. Difficulty now comes from the length of the
// mirror chain a puzzle requires. See SunBeam.js.
export class Telescope {
  constructor() {
    this.raised = false
    this.aimUnlocked = false
    this.power = null
  }

  setRaised(raised) {
    this.raised = raised
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
}
