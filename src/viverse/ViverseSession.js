export const viverseSession = {
  useAvatar() { return { available: false, message: 'VIVERSE avatar is unavailable in this local build.' } },
  records() { return { available: false, message: 'Run records are unavailable in this local build.' } },
  submitRun() { return { available: false, message: 'Run submission is unavailable in this local build.' } },
}