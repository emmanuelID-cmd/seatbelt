export function formatUsPhoneInput(value: string) {
  let digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  else digits = digits.slice(0, 10)
  if (digits.length <= 3) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatUsPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return national.length === 10
    ? `(${national.slice(0, 3)})-${national.slice(3, 6)}-${national.slice(6)}`
    : ''
}
