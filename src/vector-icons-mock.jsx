import React from 'react';

export const MaterialIcons = ({ name, size = 24, color = 'black', style }) => {
  // Map some Expo MaterialIcons names to standard Material Icons font names if they differ
  let iconName = name;
  if (name === 'repeat') iconName = 'repeat';
  if (name === 'history') iconName = 'history';
  if (name === 'trending-down') iconName = 'trending_down';
  if (name === 'attach-money') iconName = 'attach_money';
  if (name === 'shopping-bag') iconName = 'shopping_bag';
  if (name === 'calendar-today') iconName = 'calendar_today';
  if (name === 'account-balance-wallet') iconName = 'account_balance_wallet';
  if (name === 'delete-outline') iconName = 'delete_outline';

  return (
    <i 
      className="material-icons" 
      style={{ 
        fontSize: size, 
        color: color, 
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontStyle: 'normal',
        width: size,
        height: size,
        ...style 
      }}
    >
      {iconName}
    </i>
  );
};

export const Ionicons = ({ name, size = 24, color = 'black', style }) => {
  let iconName = name;
  if (name.startsWith('ios-') || name.startsWith('md-')) {
    iconName = name.replace(/^(ios|md)-/, '');
  }
  return <MaterialIcons name={iconName} size={size} color={color} style={style} />;
};
