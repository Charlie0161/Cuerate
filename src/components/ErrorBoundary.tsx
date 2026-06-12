import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface State { hasError: boolean; error: string | null }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.root}>
        <Ionicons name="warning-outline" size={48} color="#F5A623" />
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>This screen ran into a problem. Tap below to try again.</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })}>
          <Text style={s.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0C', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#F0EFF8', textAlign: 'center' },
  body: { fontSize: 14, color: '#8A89A0', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#7C5CFC', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
