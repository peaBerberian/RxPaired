export function generatePassword(): string {
  return generateHalfToken() + generateHalfToken();
  function generateHalfToken() {
    return Math.random().toString(36).substring(2); // remove `0.`
  }
}
