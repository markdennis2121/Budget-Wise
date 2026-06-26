import { Platform } from 'react-native';

export const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
export const SCROLL_EXTRA_PADDING = 16;
export const WEB_TAB_MENU_PADDING = 90;
export const FAB_SPACING = 16;
export const FAB_SIZE = 56;
export const FAB_RIGHT_OFFSET = 20;
export const FAB_SCROLL_BOTTOM_EXTRA = FAB_SIZE + FAB_SPACING + 12;

export const DEFAULT_ACCOUNTS = [
  { id: 'acc-cash', name: 'Cash Wallet', starting_balance: 0, type: 'Cash', color: '#4B5563' },
  { id: 'acc-gcash', name: 'GCash', starting_balance: 0, type: 'GCash', color: '#1E3A8A' },
  { id: 'acc-maya', name: 'Maya', starting_balance: 0, type: 'Maya', color: '#059669' },
  { id: 'acc-bpi', name: 'BPI Bank', starting_balance: 0, type: 'BPI', color: '#B91C1C' }
];

export const WALLET_STYLES = {
  GCash: { color: '#1E3A8A', color2: '#1E40AF', name: 'GCash', logo: 'account-balance-wallet' },
  Maya: { color: '#059669', color2: '#10B981', name: 'Maya', logo: 'account-balance-wallet' },
  GoTyme: { color: '#111827', color2: '#374151', name: 'GoTyme Bank', logo: 'stars' },
  BPI: { color: '#B91C1C', color2: '#DC2626', name: 'BPI Bank', logo: 'account-balance' },
  BDO: { color: '#002E6E', color2: '#0033A0', name: 'BDO Unibank', logo: 'account-balance' },
  EastWest: { color: '#4B1B8A', color2: '#6D28D9', name: 'EastWest', logo: 'account-balance' },
  Metrobank: { color: '#0033A0', color2: '#1E40AF', name: 'Metrobank', logo: 'account-balance' },
  PNB: { color: '#8A1B1D', color2: '#B91C1C', name: 'PNB', logo: 'account-balance' },
  RCBC: { color: '#004B87', color2: '#005FA3', name: 'RCBC', logo: 'account-balance' },
  SecurityBank: { color: '#00A4E8', color2: '#38BDF8', name: 'Security Bank', logo: 'account-balance' },
  Wise: { color: '#9FE870', color2: '#86EFAC', name: 'Wise', logo: 'payment' },
  MariBank: { color: '#EA580C', color2: '#F97316', name: 'MariBank', logo: 'shopping-bag' },
  SeaBank: { color: '#F97316', color2: '#FB923C', name: 'SeaBank', logo: 'credit-card' },
  Tonik: { color: '#DB2777', color2: '#F472B6', name: 'Tonik Bank', logo: 'savings' },
  PayPal: { color: '#2563EB', color2: '#3B82F6', name: 'PayPal', logo: 'payment' },
  Landbank: { color: '#4CAF50', color2: '#8BC34A', name: 'Landbank', logo: 'account-balance' },
  Vybe: { color: '#7C3AED', color2: '#8B5CF6', name: 'Vybe', logo: 'account-balance-wallet' },
  Cash: { color: '#4B5563', color2: '#6B7280', name: 'Cash Wallet', logo: 'money' },
  Custom: { color: '#0F766E', color2: '#14B8A6', name: 'Custom Bank', logo: 'credit-card' }
};

export const DEFAULT_ENVELOPES = [
  { id: 'env-housing', name: 'Housing', assigned: 0 },
  { id: 'env-food', name: 'Food', assigned: 0 },
  { id: 'env-transport', name: 'Transport', assigned: 0 }
];
