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

  // Selene opens with the telescope already in hand -- the traveler carried the frame out of
  // Helios -- but with no lens in it. Raising the scope therefore shows the crater's out-of-phase
  // surfaces as ghosts while focusing the moon does nothing, which is the wordless "you are missing
  // a lens". It mirrors Helios, where the frame switches the optical layer on and the lens is what
  // makes it act on anything.
  carryFrame() {
    this.aimUnlocked = true
    this.power = null
    this.setRaised(false)
  }

  resetPower() {
    this.aimUnlocked = false
    this.power = null
    this.setRaised(false)
  }
}
