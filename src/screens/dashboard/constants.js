import { Platform } from 'react-native';

export const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
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
  GCash: { color: '#1E3A8A', name: 'GCash', logo: 'account-balance-wallet' },
  Maya: { color: '#059669', name: 'Maya', logo: 'account-balance-wallet' },
  GoTyme: { color: '#111827', name: 'GoTyme Bank', logo: 'stars' },
  BPI: { color: '#B91C1C', name: 'BPI Bank', logo: 'account-balance' },
  BDO: { color: '#002E6E', name: 'BDO Unibank', logo: 'account-balance' },
  EastWest: { color: '#4B1B8A', name: 'EastWest', logo: 'account-balance' },
  Metrobank: { color: '#0033A0', name: 'Metrobank', logo: 'account-balance' },
  PNB: { color: '#8A1B1D', name: 'PNB', logo: 'account-balance' },
  RCBC: { color: '#004B87', name: 'RCBC', logo: 'account-balance' },
  SecurityBank: { color: '#00A4E8', name: 'Security Bank', logo: 'account-balance' },
  Wise: { color: '#9FE870', name: 'Wise', logo: 'payment' },
  MariBank: { color: '#EA580C', name: 'MariBank', logo: 'shopping-bag' },
  SeaBank: { color: '#F97316', name: 'SeaBank', logo: 'credit-card' },
  Tonik: { color: '#DB2777', name: 'Tonik Bank', logo: 'savings' },
  PayPal: { color: '#2563EB', name: 'PayPal', logo: 'payment' },
  Landbank: { color: '#4CAF50', name: 'Landbank', logo: 'account-balance' },
  Vybe: { color: '#7C3AED', name: 'Vybe', logo: 'account-balance-wallet' },
  Cash: { color: '#4B5563', name: 'Cash Wallet', logo: 'money' },
  Custom: { color: '#0F766E', name: 'Wallet/Bank', logo: 'credit-card' }
};

export const DEFAULT_ENVELOPES = [
  { id: 'env-housing', name: 'Housing', assigned: 0 },
  { id: 'env-food', name: 'Food', assigned: 0 },
  { id: 'env-transport', name: 'Transport', assigned: 0 }
];
