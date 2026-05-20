import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src/screens/DashboardScreen.jsx');
const out = path.join(root, 'src/screens/DashboardScreen.jsx');

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const header = `import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Modal, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import EmptyStateCard from '../components/EmptyStateCard';
import RtaNudgeBanner from '../components/RtaNudgeBanner';
import TrialCountdownBanner from '../components/TrialCountdownBanner';
import BrandLogo from '../components/BrandLogo';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { deleteEnvelopeAndCleanup } from '../utils/envelopeBudget';
import logoImg from '../assets/logo.png';
import { formatCurrency } from '../utils/helpers';
import {
  TAB_MENU_HEIGHT,
  SCROLL_EXTRA_PADDING,
  WEB_TAB_MENU_PADDING,
  FAB_SPACING,
  FAB_SCROLL_BOTTOM_EXTRA,
  WALLET_STYLES
} from './dashboard/constants';
import { useDashboardState } from './dashboard/useDashboardState';
import { promptDeleteEnvelope, getEnvelopeIcon } from './dashboard/envelopeUtils';
import {
  OnboardingModal,
  SpentManagerModal,
  QuickAddBudgetModal,
  IncomeManagerModal,
  AddEnvelopeModal,
  EditEnvelopeModal,
  TransferEnvelopeModal,
  SavingsManagerModal,
  AddAccountModal,
  EditAccountModal,
  NotificationCenterModal
} from './dashboard/modals';

`;
const body = lines.slice(2235).join('\n');
fs.writeFileSync(out, header + body);
console.log('Wrote slim DashboardScreen', fs.statSync(out).size);
