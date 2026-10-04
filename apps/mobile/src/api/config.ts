const url = process.env.EXPO_PUBLIC_API_URL
const key = process.env.EXPO_PUBLIC_API_KEY

console.log('API URL:', url)
console.log('API KEY configured:', Boolean(key))

if (!url) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured')
}

if (!key) {
  throw new Error('EXPO_PUBLIC_API_KEY is not configured')
}

export const API_URL = url

export const apiHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  'X-API-Key': key,
}
