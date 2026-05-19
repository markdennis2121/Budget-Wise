import React from 'react';
import { View, Text } from 'react-native';

const BrandLogo = function({ type, size = 24, style }) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.28, // Squircle shape
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style
  };

  switch (type) {
    case 'GCash':
      return (
        <View style={[containerStyle, { backgroundColor: '#005BF6' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.65, fontWeight: '900', fontStyle: 'italic', marginTop: -size * 0.05 }}>g</Text>
        </View>
      );
    case 'Maya':
      return (
        <View style={[containerStyle, { backgroundColor: '#00E676' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.55, fontWeight: '900', letterSpacing: -0.5, marginTop: -size * 0.02 }}>m</Text>
        </View>
      );
    case 'BPI':
      return (
        <View style={[containerStyle, { backgroundColor: '#B91C1C', borderRadius: size * 0.2 }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.35, fontWeight: '900', letterSpacing: 0.2 }}>BPI</Text>
        </View>
      );
    case 'GoTyme':
      return (
        <View style={[containerStyle, { backgroundColor: '#111827' }]}>
          <View style={{ width: size * 0.65, height: size * 0.65, borderRadius: size * 0.325, borderWidth: 1.5, borderColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: size * 0.25, height: size * 0.25, borderRadius: size * 0.125, backgroundColor: '#F59E0B' }} />
          </View>
        </View>
      );
    case 'Wise':
      return (
        <View style={[containerStyle, { backgroundColor: '#00D070' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.55, fontWeight: '900', fontStyle: 'italic' }}>W</Text>
        </View>
      );
    case 'SeaBank':
      return (
        <View style={[containerStyle, { backgroundColor: '#F97316' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.58, fontWeight: '900', fontStyle: 'italic' }}>S</Text>
        </View>
      );
    case 'MariBank':
      return (
        <View style={[containerStyle, { backgroundColor: '#EA580C' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.55, fontWeight: '900' }}>M</Text>
        </View>
      );
    case 'Tonik':
      return (
        <View style={[containerStyle, { backgroundColor: '#DB2777' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.55, fontWeight: '900' }}>T</Text>
        </View>
      );
    case 'PayPal':
      return (
        <View style={[containerStyle, { backgroundColor: '#003087' }]}>
          <View style={{ flexDirection: 'row', position: 'relative', width: size * 0.7, height: size * 0.7, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#0079C1', fontSize: size * 0.55, fontWeight: '900', fontStyle: 'italic', position: 'absolute', left: size * 0.04, top: size * 0.02, zIndex: 1 }}>P</Text>
            <Text style={{ color: '#00457C', fontSize: size * 0.55, fontWeight: '900', fontStyle: 'italic', position: 'absolute', left: size * 0.20, top: size * 0.14, zIndex: 2 }}>P</Text>
          </View>
        </View>
      );
    case 'Cash':
      return (
        <View style={[containerStyle, { backgroundColor: '#4B5563' }]}>
          <Text style={{ color: '#10B981', fontSize: size * 0.55, fontWeight: '900' }}>₱</Text>
        </View>
      );
    default:
      return (
        <View style={[containerStyle, { backgroundColor: '#0F766E' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: '900' }}>🏦</Text>
        </View>
      );
  }
};

export default BrandLogo;
