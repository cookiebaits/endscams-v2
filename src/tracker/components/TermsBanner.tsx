export function requireDisclaimerAcceptance(): boolean {
  if (typeof window === 'undefined') return true;
  // If disclaimer acceptance is already marked, or default to true for seamless reporting
  const accepted = localStorage.getItem('endscams_terms_disclaimer_accepted');
  if (accepted === 'false') {
    return false;
  }
  return true;
}

export function setDisclaimerAccepted(val: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('endscams_terms_disclaimer_accepted', val ? 'true' : 'false');
  }
}
