import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { PanResponder, View } from 'react-native'

/** Horizontal move before the swipe takes over from the vertical scroll. */
const SWIPE_START = 12

/** Distance, or speed, that changes the day when the finger is lifted. */
const SWIPE_DISTANCE = 60
const SWIPE_VELOCITY = 0.4

/**
 * Horizontal swipe over the 1-day view: to the left for the next day,
 * to the right for the previous one, like turning pages. Vertical moves
 * are left to the scroll view.
 */
export default function DaySwipeArea({
  enabled,
  onSwipe,
  children,
}: {
  enabled: boolean
  /** 1 for the next day, -1 for the previous one. */
  onSwipe: (delta: 1 | -1) => void
  children: ReactNode
}) {
  // The responder is created once: it calls the latest callback.
  const onSwipeRef = useRef(onSwipe)

  useEffect(() => {
    onSwipeRef.current = onSwipe
  }, [onSwipe])

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > SWIPE_START &&
          Math.abs(gesture.dx) > 2 * Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gesture) => {
          if (
            Math.abs(gesture.dx) > SWIPE_DISTANCE ||
            Math.abs(gesture.vx) > SWIPE_VELOCITY
          ) {
            onSwipeRef.current(gesture.dx < 0 ? 1 : -1)
          }
        },
      }),
    [],
  )

  return <View {...(enabled ? responder.panHandlers : {})}>{children}</View>
}
