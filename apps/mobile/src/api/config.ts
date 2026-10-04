const url = process.env.EXPO_PUBLIC_API_URL

console.log('API URL:', url)

if (!url) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured')
}

export const API_URL = url
