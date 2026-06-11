import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

const C = {
  surface: '#13131A',
  raised: '#1C1C26',
  shimmer: '#2A2A38',
};

function SkeletonBox({ width, height, style, borderRadius = 6 }: {
  width: number | string;
  height: number;
  style?: ViewStyle;
  borderRadius?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: C.shimmer, opacity }, style]}
    />
  );
}

export function DJCardSkeleton() {
  return (
    <View style={s.djCard}>
      <SkeletonBox width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width="60%" height={14} />
        <SkeletonBox width="40%" height={11} />
      </View>
      <SkeletonBox width={70} height={32} borderRadius={8} />
    </View>
  );
}

export function MixCardSkeleton() {
  return (
    <View style={s.mixCard}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        <SkeletonBox width={70} height={20} borderRadius={4} />
        <SkeletonBox width={50} height={20} borderRadius={4} />
      </View>
      <SkeletonBox width="85%" height={16} style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <SkeletonBox width={24} height={24} borderRadius={12} />
        <SkeletonBox width="40%" height={12} />
      </View>
      <View style={s.mixCardActions}>
        {[1, 2, 3, 4].map(i => <SkeletonBox key={i} width={52} height={28} borderRadius={7} />)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  djCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1,
    borderColor: '#2A2A38', padding: 14,
  },
  mixCard: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1,
    borderColor: '#2A2A38', padding: 14,
  },
  mixCardActions: { flexDirection: 'row', gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2A2A38' },
});
