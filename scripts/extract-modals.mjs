import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src/screens/DashboardScreen.jsx');
const out = path.join(root, 'src/screens/dashboard/modals.jsx');

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const header = `import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../../contexts/ThemeContext';
import SaveSuccessOverlay from '../../components/SaveSuccessOverlay';
import AmountInput from '../../components/AmountInput';
import DatePickerInput from '../../components/DatePickerInput';
import BrandLogo from '../../components/BrandLogo';
import { runSaveWithFeedback } from '../../utils/saveSuccess';
import { deleteEnvelopeAndCleanup } from '../../utils/envelopeBudget';
import { promptDeleteEnvelope } from './envelopeUtils';
import { formatCurrency, generateId, getTodayStr, getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue } from '../../utils/helpers';
import { WALLET_STYLES } from './constants';

`;
const body = lines.slice(340, 2220).join('\n');
const exports = `
export {
  AssignMoneyModal,
  AddEnvelopeModal,
  SavingsManagerModal,
  NotificationCenterModal,
  AddAccountModal,
  EditAccountModal,
  EditEnvelopeModal,
  TransferEnvelopeModal,
  EditSalaryModal,
  OnboardingModal,
  IncomeManagerModal,
  SpentManagerModal,
  QuickAddBudgetModal
};
`;
fs.writeFileSync(out, header + body + exports);
console.log('Wrote', out, fs.statSync(out).size, 'bytes');
