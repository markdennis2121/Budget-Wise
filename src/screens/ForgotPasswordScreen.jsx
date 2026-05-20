import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';
import logoImg from '../assets/logo.png';

const ForgotPasswordScreen = function (props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();

  var [step, setStep] = useState(1);
  var [email, setEmail] = useState('');
  var [resetUserId, setResetUserId] = useState(null);
  var [newPassword, setNewPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');
  var [errorMsg, setErrorMsg] = useState('');
  var [isLoading, setIsLoading] = useState(false);

  var usersQuery = useQuery('budget_users');
  var allUsers = usersQuery.data || [];
  var updateUser = useMutation('budget_users', 'update');
  var mutateUpdateUser = updateUser.mutate;

  var handleFindAccount = function () {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    setTimeout(function () {
      var normalized = email.trim().toLowerCase();
      var found = allUsers.find(function (u) { return u.email === normalized; });
      if (found) {
        setResetUserId(found.id);
        setStep(2);
      } else {
        setErrorMsg('No account found with this email on this device. Use the email you signed up with, or create a new account.');
      }
      setIsLoading(false);
    }, 200);
  };

  var handleResetPassword = function () {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setErrorMsg('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (!resetUserId) {
      setErrorMsg('Something went wrong. Please start over.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    mutateUpdateUser({ id: resetUserId, data: { password: newPassword } })
      .then(function () {
        navigation.navigate('Login', {
          email: email.trim().toLowerCase(),
          resetMessage: 'Password updated. Sign in with your new password.'
        });
      })
      .catch(function () {
        setErrorMsg('Could not reset password. Please try again.');
        setIsLoading(false);
      });
  };

  return React.createElement(KeyboardAvoidingWrapper, {
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: { flex: 1, backgroundColor: theme.colors.background }
  },
    React.createElement(ScrollView, {
      contentContainerStyle: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 40
      },
      keyboardShouldPersistTaps: 'handled'
    },
      React.createElement(View, { style: { alignItems: 'center', marginBottom: 28 } },
        React.createElement(Image, {
          source: logoImg,
          style: { width: 80, height: 80, borderRadius: 20, resizeMode: 'contain', marginBottom: 10 }
        }),
        React.createElement(Text, { style: { fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Reset Password'),
        React.createElement(Text, {
          style: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 }
        }, step === 1
          ? 'Enter the email for your Penny account on this device.'
          : 'Choose a new password for ' + email.trim().toLowerCase() + '.')
      ),

      React.createElement(View, {
        style: {
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3
        }
      },
        errorMsg ? React.createElement(View, {
          style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 }
        },
          React.createElement(Text, { style: { color: theme.colors.error, fontSize: 14 } }, errorMsg)
        ) : null,

        step === 1 ? React.createElement(View, null,
          React.createElement(Text, {
            style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }
          }, 'EMAIL'),
          React.createElement(TextInput, {
            value: email,
            onChangeText: setEmail,
            placeholder: 'your@email.com',
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoCorrect: false,
            style: {
              backgroundColor: theme.colors.background,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 10,
              padding: 14,
              fontSize: 15,
              color: theme.colors.textPrimary,
              marginBottom: 20
            }
          }),
          React.createElement(TouchableOpacity, {
            onPress: handleFindAccount,
            disabled: isLoading,
            style: {
              backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center'
            }
          },
            isLoading
              ? React.createElement(ActivityIndicator, { color: '#FFFFFF' })
              : React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Continue')
          )
        ) : React.createElement(View, null,
          React.createElement(Text, {
            style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }
          }, 'NEW PASSWORD'),
          React.createElement(TextInput, {
            value: newPassword,
            onChangeText: setNewPassword,
            placeholder: '••••••••',
            secureTextEntry: true,
            autoCapitalize: 'none',
            autoCorrect: false,
            style: {
              backgroundColor: theme.colors.background,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 10,
              padding: 14,
              fontSize: 15,
              color: theme.colors.textPrimary,
              marginBottom: 16
            }
          }),
          React.createElement(Text, {
            style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }
          }, 'CONFIRM PASSWORD'),
          React.createElement(TextInput, {
            value: confirmPassword,
            onChangeText: setConfirmPassword,
            placeholder: '••••••••',
            secureTextEntry: true,
            autoCapitalize: 'none',
            autoCorrect: false,
            style: {
              backgroundColor: theme.colors.background,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 10,
              padding: 14,
              fontSize: 15,
              color: theme.colors.textPrimary,
              marginBottom: 20
            }
          }),
          React.createElement(TouchableOpacity, {
            onPress: handleResetPassword,
            disabled: isLoading,
            style: {
              backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 12
            }
          },
            isLoading
              ? React.createElement(ActivityIndicator, { color: '#FFFFFF' })
              : React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Update Password')
          ),
          React.createElement(TouchableOpacity, {
            onPress: function () { setStep(1); setErrorMsg(''); setNewPassword(''); setConfirmPassword(''); },
            style: { alignItems: 'center', paddingVertical: 8 }
          },
            React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 14 } }, 'Use a different email')
          )
        ),

        React.createElement(View, {
          style: {
            marginTop: 20,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'flex-start'
          }
        },
          React.createElement(MaterialIcons, {
            name: 'info-outline',
            size: 18,
            color: theme.colors.textSecondary,
            style: { marginRight: 8, marginTop: 1 }
          }),
          React.createElement(Text, {
            style: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 }
          }, 'Penny stores accounts on this device only. Password reset works for emails already registered here — there is no email link sent.')
        ),

        React.createElement(TouchableOpacity, {
          onPress: function () { navigation.navigate('Login'); },
          style: { marginTop: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }
        },
          React.createElement(MaterialIcons, { name: 'arrow-back', size: 18, color: theme.colors.primary, style: { marginRight: 4 } }),
          React.createElement(Text, { style: { color: theme.colors.primary, fontSize: 14, fontWeight: '600' } }, 'Back to Sign In')
        )
      )
    )
  );
};

export default ForgotPasswordScreen;
