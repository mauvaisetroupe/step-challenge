import * as Clipboard from 'expo-clipboard'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  Description,
  PrimaryButton,
  SecondaryButton,
  SettingsPage,
} from '@/components/settings/ui'
import {
  formatDiagnostic,
  getHealthConnectDiagnostic,
  type DiagnosticItem,
  type HealthConnectDiagnostic,
} from '@/services/healthConnectDiagnostic'
import { getHuaweiHealthDiagnostic } from '@/services/huaweiHealthDiagnostic'
import { useThemedStyles, type Colors } from '@/theme'

/** Checks Health Connect, permissions, Huawei Health and the server. */
export default function DiagnosticSettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const [diagnostic, setDiagnostic] =
    useState<HealthConnectDiagnostic | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    setCopied(false)

    try {
      const result = await getHealthConnectDiagnostic()
      const huaweiItems = await getHuaweiHealthDiagnostic()

      setDiagnostic({
        ...result,
        items: [...result.items, ...huaweiItems],
      })
    } catch (error) {
      console.error('Diagnostic error:', error)

      setDiagnostic({
        items: [
          {
            label: 'Diagnostic',
            value: error instanceof Error ? error.message : 'Erreur inconnue',
            status: 'error',
          },
        ],
        generatedAt: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const copy = async () => {
    if (!diagnostic) {
      return
    }

    await Clipboard.setStringAsync(formatDiagnostic(diagnostic))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SettingsPage>
      <Description>
        Vérifie la connexion à Santé Connect, les autorisations et l'accès au
        serveur.
      </Description>

      <PrimaryButton
        title="Lancer le diagnostic"
        onPress={run}
        loading={loading}
      />

      {diagnostic && (
        <View style={styles.card}>
          {diagnostic.items.map((item, index) => (
            <DiagnosticRow key={`${item.label}-${index}`} item={item} />
          ))}

          <View style={styles.separator} />

          <Text style={styles.generatedAt}>
            Diagnostic généré le{' '}
            {new Date(diagnostic.generatedAt).toLocaleString('fr-FR')}
          </Text>

          <SecondaryButton
            title={copied ? '✓ Diagnostic copié' : 'Copier le diagnostic'}
            onPress={copy}
          />
        </View>
      )}
    </SettingsPage>
  )
}

function DiagnosticRow({ item }: { item: DiagnosticItem }) {
  const styles = useThemedStyles(createStyles)

  const icon =
    item.status === 'ok'
      ? '✓'
      : item.status === 'error'
        ? '✕'
        : item.status === 'warning'
          ? '!'
          : '?'

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.status,
          item.status === 'ok' && styles.statusOk,
          item.status === 'error' && styles.statusError,
          item.status === 'warning' && styles.statusWarning,
        ]}
      >
        <Text style={styles.statusText}>{icon}</Text>
      </View>

      <Text style={styles.label}>{item.label}</Text>

      <Text style={styles.value} numberOfLines={3}>
        {item.value}
      </Text>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginTop: 4,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
    },

    row: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    status: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },

    statusOk: {
      backgroundColor: c.successSoft,
    },

    statusError: {
      backgroundColor: c.dangerSoft,
    },

    statusWarning: {
      backgroundColor: c.warningSoft,
    },

    statusText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
    },

    label: {
      width: 125,
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
    },

    value: {
      flex: 1,
      fontSize: 14,
      color: c.text,
      textAlign: 'right',
    },

    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 12,
    },

    generatedAt: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 12,
    },
  })
