import { Image, StyleSheet, Text, View } from 'react-native'

/**
 * Title of the header shared by the tab screens: app logo and name.
 */
export default function AppHeaderTitle() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/app-logo.png')}
        style={styles.logo}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>Step Challenge</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
})
