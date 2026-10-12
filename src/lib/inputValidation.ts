export const PASSWORD_ALLOWED_SYMBOLS = '!.@,#$%&*_-+'

const PASSWORD_ALLOWED_CHARACTERS = /[^A-Za-z0-9!.@,#$%&*_\-+]/g
const NAME_ALLOWED_CHARACTERS = /[^\p{L}\p{M}\p{N}' -]/gu

export function sanitizePassword(value: string) {
  return value.replace(PASSWORD_ALLOWED_CHARACTERS, '').slice(0, 32)
}

export function validatePassword(value: string) {
  if (value.length < 8 || value.length > 32) {
    return 'Password must be 8–32 characters.'
  }
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[!.@,#$%&*_\-+]/.test(value)) {
    return 'Password must include uppercase, lowercase, a number, and an allowed symbol.'
  }
  return ''
}

export function sanitizeFullName(value: string) {
  const sanitizedValue = value.replace(NAME_ALLOWED_CHARACTERS, '').slice(0, 32)
  let nameParts = 0
  let insideNamePart = false
  let result = ''

  for (const character of sanitizedValue) {
    if (character === ' ') {
      insideNamePart = false
      result += character
      continue
    }

    if (!insideNamePart) {
      if (nameParts === 4) break
      nameParts += 1
      insideNamePart = true
    }

    result += character
  }

  return result
}

export function validateFullName(value: string) {
  return value.trim() ? '' : 'Please enter your full name.'
}

export function validateEmail(value: string) {
  const email = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.'
}

export function validateMessage(value: string) {
  if (!value.trim()) return 'Enter a message.'
  if (Array.from(value).length > 140) return 'Messages can be up to 140 characters.'
  return ''
}
