import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { primaryColor, textPrimary, textSecondary, cardColor } from '../contexts/ThemeContext';
import { padNum } from '../utils/helpers';

const DatePickerInput = function(props) {
  var parsed = props.value ? props.value.split('-') : null;
  var nowYear = new Date().getFullYear();
  var nowMonth = new Date().getMonth() + 1;
  var nowDay = new Date().getDate();
  var initYear = parsed ? parseInt(parsed[0], 10) : nowYear;
  var initMonth = parsed ? parseInt(parsed[1], 10) : nowMonth;
  var initDay = parsed ? parseInt(parsed[2], 10) : nowDay;
  var showState = useState(false);
  var showPicker = showState[0];
  var setShow = showState[1];
  var yearState = useState(initYear);
  var selYear = yearState[0];
  var setSelYear = yearState[1];
  var monthState = useState(initMonth);
  var selMonth = monthState[0];
  var setSelMonth = monthState[1];
  var dayState = useState(initDay);
  var selDay = dayState[0];
  var setSelDay = dayState[1];
  useEffect(function() {
    var maxDay = new Date(selYear, selMonth, 0).getDate();
    if (selDay > maxDay) { setSelDay(maxDay); }
  }, [selYear, selMonth]);
  var handleConfirm = function() {
    if (props.onChange) { props.onChange(selYear + '-' + padNum(selMonth) + '-' + padNum(selDay)); }
    setShow(false);
  };
  var displayValue = props.value ? (padNum(selMonth) + '/' + padNum(selDay) + '/' + selYear) : (props.placeholder || 'Select date');
  if (Platform.OS === 'web') {
    return React.createElement('input', { testID: 'input-1', type: 'date', value: props.value || '',
      onChange: function(e) { if (props.onChange) { props.onChange(e.target.value); } },
      style: Object.assign({}, { padding: 12, border: '1px solid #FED7AA', borderRadius: 8, fontSize: 16, width: '100%', boxSizing: 'border-box', color: textPrimary, backgroundColor: '#FFF7ED', outline: 'none' }, props.style)
    });
  }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var years = [];
  for (var y = nowYear - 5; y <= nowYear + 5; y++) { years.push(y); }
  var daysInMonth = new Date(selYear, selMonth, 0).getDate();
  var days = [];
  for (var d = 1; d <= daysInMonth; d++) { days.push(d); }
  var colStyle = { flex: 1, maxHeight: 180 };
  var itemStyleFn = function(active) { return { paddingVertical: 10, alignItems: 'center', backgroundColor: active ? '#FED7AA' : 'transparent' }; };
  var itemTextStyleFn = function(active) { return { fontSize: 15, color: active ? primaryColor : textPrimary, fontWeight: active ? 'bold' : 'normal' }; };
  return React.createElement(View, { testID: 'View-1', componentId: props.componentId },
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-1', onPress: function() { setShow(true); },
      style: Object.assign({}, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFF7ED' }, props.style)
    },
      React.createElement(Text, { testID: 'Text-1', style: { fontSize: 15, color: props.value ? textPrimary : textSecondary } }, displayValue),
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-1', name: 'calendar-today', size: 18, color: primaryColor })
    ),
    React.createElement(Modal, { testID: 'Modal-1', visible: showPicker, transparent: true, animationType: 'slide', onRequestClose: function() { setShow(false); } },
      React.createElement(View, { testID: 'View-2', style: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' } },
        React.createElement(View, { testID: 'View-3', style: { backgroundColor: cardColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 } },
          React.createElement(Text, { testID: 'Text-2', style: { fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: textPrimary } }, 'Select Date'),
          React.createElement(View, { testID: 'View-4', style: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden' } },
            React.createElement(ScrollView, { testID: 'ScrollView-1', style: colStyle, showsVerticalScrollIndicator: false },
              MONTHS.map(function(m, i) {
                var active = selMonth === i + 1;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-2', key: String(i), onPress: function() { setSelMonth(i + 1); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-3', style: itemTextStyleFn(active) }, m));
              })
            ),
            React.createElement(ScrollView, { testID: 'ScrollView-2', style: colStyle, showsVerticalScrollIndicator: false },
              days.map(function(d2) {
                var active = selDay === d2;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-3', key: String(d2), onPress: function() { setSelDay(d2); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-4', style: itemTextStyleFn(active) }, String(d2)));
              })
            ),
            React.createElement(ScrollView, { testID: 'ScrollView-3', style: colStyle, showsVerticalScrollIndicator: false },
              years.map(function(yr) {
                var active = selYear === yr;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-4', key: String(yr), onPress: function() { setSelYear(yr); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-5', style: itemTextStyleFn(active) }, String(yr)));
              })
            )
          ),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-5', onPress: handleConfirm, style: { backgroundColor: primaryColor, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 } },
            React.createElement(Text, { testID: 'Text-6', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Confirm')),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-6', onPress: function() { setShow(false); }, style: { padding: 12, alignItems: 'center' } },
            React.createElement(Text, { testID: 'Text-7', style: { color: textSecondary, fontSize: 15 } }, 'Cancel'))
        )
      )
    )
  );
};
export default DatePickerInput;
