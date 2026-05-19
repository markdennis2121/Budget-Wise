import React, { createContext, useState, useMemo, useContext } from 'react';

const UserContext = createContext({ currentUser: null, setCurrentUser: function() {} });

export const UserProvider = function(props) {
  var [currentUser, setCurrentUser] = useState(() => {
    try {
      var saved = localStorage.getItem('budget_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  var handleSetCurrentUser = function(user) {
    setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem('budget_active_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('budget_active_user');
      }
    } catch (e) {
      console.error('Failed to save session', e);
    }
  };

  var value = useMemo(function() {
    return { currentUser: currentUser, setCurrentUser: handleSetCurrentUser };
  }, [currentUser]);

  return React.createElement(UserContext.Provider, { testID: 'Provider-1', value: value }, props.children);
};

export const useUser = function() { return useContext(UserContext); };
