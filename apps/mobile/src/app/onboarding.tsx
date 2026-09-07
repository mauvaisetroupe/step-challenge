import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { createUser } from '../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'

export default function OnboardingScreen() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Entre ton prénom')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const user = await createUser(trimmedName)

      await AsyncStorage.setItem(USER_ID_KEY, user.id)

      router.replace('/home')
    } catch (err) {
      console.error('User registration error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de créer le profil',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    > 
    <View style={styles.content}>
      <Text style={styles.eyebrow}>PREMIER LANCEMENT</Text>

        <Text style={styles.title}>Step Challenge</Text>

        <Text style={styles.question}>
          Comment tu t'appelles ?
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(value) => {
            setName(value)
            setError(null)
          }}
          placeholder="Ton prénom"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          editable={!loading}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.button,
            (!name.trim() || loading) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!name.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Création...' : 'Continuer'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  eyebrow: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },

  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 56,
  },

  question: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },

  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#111827',
    fontSize: 18,
  },

  error: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 10,
  },

  button: {
    marginTop: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#208AEF',
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
})