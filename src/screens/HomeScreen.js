import React from 'react';
import { SafeAreaView } from 'react-native';

export default function HomeScreen({ children, style }) {
  return <SafeAreaView style={style}>{children}</SafeAreaView>;
}
