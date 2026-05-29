import React from 'react';
import { View, Text, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import tonikImg from '../assets/wallet logos/Tonik.webp';
import bdoImg from '../assets/wallet logos/bdo.webp';
import bpiImg from '../assets/wallet logos/bpi.webp';
import eastwestImg from '../assets/wallet logos/eastwest.webp';
import gcashImg from '../assets/wallet logos/gcash.webp';
import gotymeImg from '../assets/wallet logos/gotyme.webp';
import maribankImg from '../assets/wallet logos/maribank.webp';
import mayaImg from '../assets/wallet logos/maya.webp';
import paypalImg from '../assets/wallet logos/paypal.webp';
import wiseImg from '../assets/wallet logos/wise.webp';
import metrobankImg from '../assets/wallet logos/metrobank.png';
import pnbImg from '../assets/wallet logos/pnb.png';
import rcbcImg from '../assets/wallet logos/rcbc.jpg';
import securityBankImg from '../assets/wallet logos/securitybank.jpg';
import landbankImg from '../assets/wallet logos/landbank.png';
import vybeImg from '../assets/wallet logos/vybe.jpg';

const BrandLogo = function({ type, size = 24, style }) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style
  };

  const renderImage = (imgSource) => (
    <Image source={imgSource} style={containerStyle} resizeMode="cover" />
  );

  switch (type) {
    case 'GCash':
      return renderImage(gcashImg);
    case 'Maya':
      return renderImage(mayaImg);
    case 'BPI':
      return renderImage(bpiImg);
    case 'GoTyme':
      return renderImage(gotymeImg);
    case 'Wise':
      return renderImage(wiseImg);
    case 'MariBank':
      return renderImage(maribankImg);
    case 'Tonik':
      return renderImage(tonikImg);
    case 'PayPal':
      return renderImage(paypalImg);
    case 'BDO':
      return renderImage(bdoImg);
    case 'EastWest':
      return renderImage(eastwestImg);
    case 'Metrobank':
      return renderImage(metrobankImg);
    case 'PNB':
      return renderImage(pnbImg);
    case 'RCBC':
      return renderImage(rcbcImg);
    case 'SecurityBank':
      return renderImage(securityBankImg);
    case 'Landbank':
      return renderImage(landbankImg);
    case 'Vybe':
      return renderImage(vybeImg);

    // Fallbacks for logos that don't have images yet
    case 'SeaBank':
      return (
        <View style={[containerStyle, { backgroundColor: '#F97316' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.6, fontWeight: '900', fontStyle: 'italic' }}>S</Text>
        </View>
      );
    case 'Cash':
      return (
        <View style={[containerStyle, { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' }]}>
          <Text style={{ color: '#059669', fontSize: size * 0.55, fontWeight: '900' }}>₱</Text>
        </View>
      );
    default:
      return (
        <View style={[containerStyle, { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }]}>
          <MaterialIcons name="account-balance" size={size * 0.6} color="#4B5563" />
        </View>
      );
  }
};

export default BrandLogo;
