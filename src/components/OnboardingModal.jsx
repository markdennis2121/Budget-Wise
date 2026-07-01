import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { scale, moderateScale, normalize } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { triggerSuccessHaptic } from '../utils/feedback';
import logoImg from '../assets/logo.png';

export var ONBOARDING_STEPS = [
  {
    id: 'welcome',
    icon: 'celebration',
    accent: '#FFEDD5',
    title: 'Welcome to Penny',
    subtitle: 'Premium Financial Command Center.',
    body: 'A premium, private budgeting experience designed to adapt to your lifestyle—whether you are a detailed planner or a busy tracker.',
    showLogo: true
  },
  {
    id: 'mode_selection',
    icon: 'tune',
    accent: '#E0F2FE',
    title: 'Choose your style',
    subtitle: 'Adaptive experience.',
    isModeSelection: true
  },
  {
    id: 'visuals',
    icon: 'account-balance-wallet',
    accent: '#EDE9FE',
    title: 'Modern Premium UI',
    subtitle: 'Beauty meets function.',
    body: 'Your wallets now feature premium mesh gradients. Experience our new mobile-first vertical Transfer flow with smart logo detection and real-time balance previews.'
  },
  {
    id: 'envelopes',
    icon: 'all-inbox',
    accent: '#DBEAFE',
    title: 'Smart Envelopes',
    subtitle: 'Core Budgeting System.',
    body: 'Give every peso a job. Assign income to categories, track monthly spending, and enjoy automatic rollover assistants when a new month begins.'
  },
  {
    id: 'insights',
    icon: 'show-chart',
    accent: '#F3E8FF',
    title: 'Premium Analytics',
    subtitle: 'Visualize your wealth.',
    body: 'Watch your wealth grow with smooth Beziér line charts. Track total net worth and compare 6-month trends to master your cash flow.'
  },
  {
    id: 'premium',
    icon: 'workspace-premium',
    accent: '#FEF3C7',
    title: 'Unlock Premium',
    subtitle: 'One-time upgrade, lifetime power.',
    bullets: [
      { icon: 'palette', text: 'Exclusive themes like Rose Gold and Cosmic Purple' },
      { icon: 'security', text: 'Biometric Login (Fingerprint & FaceID)' },
      { icon: 'file-download', text: 'Excel & CSV Data Exports' },
      { icon: 'all-inclusive', text: 'Unlimited Wallets & Advanced Archive tools' }
    ]
  }
];

function markTourSeen(userSettings, mutateUpdateSettings) {
  if (!userSettings || !mutateUpdateSettings) return Promise.resolve();
  if (userSettings.has_seen_penny_tour) return Promise.resolve();
  return mutateUpdateSettings({
    id: userSettings.id,
    data: { has_seen_penny_tour: true }
  });
}

const OnboardingModal = function ({ visible, onClose, userSettings, mutateUpdateSettings }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [step, setStep] = useState(0);
  var [finishing, setFinishing] = useState(false);

  var steps = ONBOARDING_STEPS;
  var current = steps[step];
  var isLast = step >= steps.length - 1;

  useEffect(function () {
    if (visible) {
      setStep(0);
      setFinishing(false);
    }
  }, [visible]);

  var finishTour = useCallback(function () {
    if (finishing) return;
    setFinishing(true);
    triggerSuccessHaptic();
    markTourSeen(userSettings, mutateUpdateSettings)
      .catch(function () {})
      .finally(function () {
        setFinishing(false);
        onClose();
      });
  }, [finishing, userSettings, mutateUpdateSettings, onClose]);

  var goNext = function () {
    triggerSuccessHaptic();
    if (isLast) finishTour();
    else setStep(step + 1);
  };

  var goBack = function () {
    if (step > 0) setStep(step - 1);
  };

  var handleSkip = function () {
    finishTour();
  };

  if (!visible || !current) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleSkip}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          paddingHorizontal: moderateScale(20),
          paddingTop: insets.top + moderateScale(12),
          paddingBottom: insets.bottom + moderateScale(12)
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: scale(24),
            maxHeight: '92%',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: moderateScale(20),
              paddingTop: moderateScale(16),
              paddingBottom: moderateScale(8)
            }}
          >
            <Text style={{ fontSize: normalize(12), fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>
              {'STEP ' + (step + 1) + ' OF ' + steps.length}
            </Text>
            <TouchableOpacity
              onPress={handleSkip}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.background,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border
              }}
            >
              <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: moderateScale(24), paddingBottom: moderateScale(8), alignItems: 'center' }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {current.showLogo ? (
              <Image
                source={logoImg}
                resizeMode="contain"
                style={{ width: scale(72), height: scale(72), borderRadius: scale(18), marginBottom: moderateScale(16) }}
              />
            ) : (
              <View
                style={{
                  width: scale(72),
                  height: scale(72),
                  borderRadius: scale(36),
                  backgroundColor: current.accent || '#FFEDD5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: moderateScale(16)
                }}
              >
                <MaterialIcons name={current.icon} size={scale(36)} color={theme.colors.primary} />
              </View>
            )}

            <Text
              style={{
                fontSize: normalize(22),
                fontWeight: 'bold',
                color: theme.colors.textPrimary,
                marginBottom: moderateScale(6),
                textAlign: 'center'
              }}
            >
              {current.title}
            </Text>

            {current.subtitle ? (
              <Text
                style={{
                  fontSize: normalize(14),
                  fontWeight: '600',
                  color: theme.colors.primary,
                  textAlign: 'center',
                  marginBottom: moderateScale(14)
                }}
              >
                {current.subtitle}
              </Text>
            ) : null}

            {current.body ? (
              <Text
                style={{
                  fontSize: normalize(15),
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  lineHeight: normalize(23),
                  marginBottom: moderateScale(8)
                }}
              >
                {current.body}
              </Text>
            ) : null}

            {current.bullets ? (
              <View style={{ width: '100%', marginTop: moderateScale(8), marginBottom: moderateScale(4) }}>
                {current.bullets.map(function (item, idx) {
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.colors.background,
                        borderRadius: scale(12),
                        padding: moderateScale(14),
                        marginBottom: moderateScale(10),
                        borderWidth: 1,
                        borderColor: theme.colors.border
                      }}
                    >
                      <View
                        style={{
                          width: scale(32),
                          height: scale(32),
                          borderRadius: scale(16),
                          backgroundColor: theme.colors.primary + '18',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: moderateScale(12)
                        }}
                      >
                        <MaterialIcons name={item.icon} size={scale(18)} color={theme.colors.primary} />
                      </View>
                      <Text style={{ flex: 1, fontSize: normalize(14), color: theme.colors.textPrimary, lineHeight: normalize(21) }}>
                        {item.text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {current.checklist ? (
              <View style={{ width: '100%', marginTop: moderateScale(8) }}>
                {current.checklist.map(function (item, idx) {
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: moderateScale(10),
                        borderBottomWidth: idx < current.checklist.length - 1 ? 1 : 0,
                        borderBottomColor: theme.colors.border
                      }}
                    >
                      <MaterialIcons name={item.icon} size={scale(22)} color={theme.colors.primary} style={{ marginRight: 12 }} />
                      <Text style={{ flex: 1, fontSize: normalize(14), color: theme.colors.textPrimary, lineHeight: normalize(20) }}>
                        {item.text}
                      </Text>
                      <MaterialIcons name="chevron-right" size={scale(20)} color={theme.colors.textSecondary} />
                    </View>
                  );
                })}
              </View>
            ) : null}

            {current.isModeSelection ? (
              <View style={{ width: '100%', marginTop: moderateScale(10) }}>
                <TouchableOpacity
                  onPress={() => {
                    triggerSuccessHaptic();
                    mutateUpdateSettings({ id: userSettings.id, data: { budgeting_style: 'simple' } });
                    goNext();
                  }}
                  style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: scale(16),
                    padding: moderateScale(16),
                    marginBottom: moderateScale(12),
                    borderWidth: 2,
                    borderColor: userSettings?.budgeting_style === 'simple' ? theme.colors.primary : theme.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="speed" size={24} color="#0369A1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Busy Tracker (Simple)</Text>
                    <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 2 }}>Focus on wallets and quick spending.</Text>
                  </View>
                  {userSettings?.budgeting_style === 'simple' && <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    triggerSuccessHaptic();
                    mutateUpdateSettings({ id: userSettings.id, data: { budgeting_style: 'envelope' } });
                    goNext();
                  }}
                  style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: scale(16),
                    padding: moderateScale(16),
                    borderWidth: 2,
                    borderColor: userSettings?.budgeting_style !== 'simple' ? theme.colors.primary : theme.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="all-inbox" size={24} color="#15803D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Detailed Planner (Envelopes)</Text>
                    <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 2 }}>Plan every peso with the envelope system.</Text>
                  </View>
                  {userSettings?.budgeting_style !== 'simple' && <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />}
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ paddingHorizontal: moderateScale(24), paddingTop: moderateScale(12), paddingBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: scale(8), marginBottom: moderateScale(18) }}>
              {steps.map(function (_, idx) {
                return (
                  <View
                    key={idx}
                    style={{
                      width: step === idx ? scale(22) : scale(8),
                      height: scale(8),
                      borderRadius: scale(4),
                      backgroundColor: step === idx ? theme.colors.primary : theme.colors.border
                    }}
                  />
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', width: '100%', gap: moderateScale(12) }}>
              {step > 0 ? (
                <TouchableOpacity
                  onPress={goBack}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.background,
                    borderRadius: scale(14),
                    paddingVertical: moderateScale(14),
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    minHeight: scale(48)
                  }}
                >
                  <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(16), fontWeight: 'bold' }}>Back</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={goNext}
                disabled={finishing}
                style={{
                  flex: step > 0 ? 2 : 1,
                  backgroundColor: theme.colors.primary,
                  borderRadius: scale(14),
                  paddingVertical: moderateScale(14),
                  alignItems: 'center',
                  minHeight: scale(48),
                  opacity: finishing ? 0.7 : 1,
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: Platform.OS === 'web' ? 0 : 0.3,
                  shadowRadius: 8,
                  elevation: 4
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: normalize(16), fontWeight: 'bold' }}>
                  {finishing ? 'Saving…' : isLast ? "Let's go!" : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default OnboardingModal;
