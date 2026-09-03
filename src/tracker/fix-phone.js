function formatPhone(phone, countryCode) {
  const clean = phone.replace(/\D/g, '');
  if (countryCode === 'US') {
     let digits = clean.startsWith('1') && clean.length === 11 ? clean.slice(1) : clean;
     if (digits.length === 10) {
        return `1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
     }
     return `1 ${digits}`;
  }
  return `+${clean}`;
}
console.log(formatPhone("18058149400", "US"));
console.log(formatPhone("2348030000000", "NG"));
