import React from 'react';

export const MaterialIcons = ({ name, size = 24, color = 'black', style }) => {
  // Automatically convert kebab-case (Expo style) to snake_case (standard Material Icons font style)
  const iconName = name ? name.replace(/-/g, '_') : '';

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
