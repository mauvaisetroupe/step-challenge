import { Text, type StyleProp, type TextStyle } from 'react-native'

type Props = {
  /**
   * Translation with <b>…</b> for the bold parts and {{name}} for the
   * values, not interpolated yet: t(key, { count, skipInterpolation: true }).
   */
  text: string
  values?: Record<string, string>
  style?: StyleProp<TextStyle>
  boldStyle?: StyleProp<TextStyle>
}

function interpolate(text: string, values: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in values ? values[name] : match,
  )
}

/**
 * A translated sentence with bold parts (ADR 0007). The tags are split
 * before the values are inserted: a value that contains <b> (a friend's
 * name) stays plain text.
 */
export default function RichText({
  text,
  values = {},
  style,
  boldStyle,
}: Props) {
  // Odd indexes are the parts between <b> and </b>.
  const parts = text.split(/<b>(.*?)<\/b>/)

  return (
    <Text style={style}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} style={boldStyle}>
            {interpolate(part, values)}
          </Text>
        ) : (
          interpolate(part, values)
        ),
      )}
    </Text>
  )
}
