import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';

const UserContext = createContext({ currentUser: null, setCurrentUser: function() {} });
const ACTIVE_USER_KEYS = ['budget_active_user', 'penny_active_user', 'budgetwise_active_user'];

const loadSavedUser = function() {
  try {
    for (var i = 0; i < ACTIVE_USER_KEYS.length; i++) {
      var raw = localStorage.getItem(ACTIVE_USER_KEYS[i]);
      if (!raw) continue;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
};

const loadUsersFromDb = function() {
  try {
    var keys = ['budget_tracker_db', 'penny_db', 'budget_wise_db', 'budgetwise_db', 'budget_app_db'];
    for (var i = 0; i < keys.length; i++) {
      var raw = localStorage.getItem(keys[i]);
      if (!raw) continue;
      var db = JSON.parse(raw);
      if (db && Array.isArray(db.budget_users)) return db.budget_users;
      if (db && Array.isArray(db.users)) return db.users;
    }
  } catch (e) {}
  return [];
};

export const UserProvider = function(props) {
  var [currentUser, setCurrentUser] = useState(() => {
    return loadSavedUser();
  });

  var handleSetCurrentUser = function(user) {
    setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem('budget_active_user', JSON.stringify(user));
      } else {
        ACTIVE_USER_KEYS.forEach(function(key) { localStorage.removeItem(key); });
      }
    } catch (e) {
      console.error('Failed to save session', e);
    }
  };

  useEffect(function() {
    if (!currentUser) return;

    // Repair session after app updates where user shape/ID may have changed.
    var allUsers = loadUsersFromDb();
    var matched = allUsers.find(function(u) { return u.id === currentUser.id; }) ||
      allUsers.find(function(u) {
        return u.email && currentUser.email &&
          String(u.email).toLowerCase() === String(currentUser.email).toLowerCase();
      });

    if (matched && JSON.stringify(matched) !== JSON.stringify(currentUser)) {
      handleSetCurrentUser(matched);
    }
  }, [currentUser]);

  var value = useMemo(function() {
    return { currentUser: currentUser, setCurrentUser: handleSetCurrentUser };
  }, [currentUser]);

  return React.createElement(UserContext.Provider, { testID: 'Provider-1', value: value }, props.children);
};

export const useUser = function() { return useContext(UserContext); };
