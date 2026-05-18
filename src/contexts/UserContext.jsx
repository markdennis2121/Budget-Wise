import React, { createContext, useState, useMemo, useContext } from 'react';

const UserContext = createContext({ currentUser: null, setCurrentUser: function() {} });

export const UserProvider = function(props) {
  var userState = useState(null);
  var currentUser = userState[0];
  var setCurrentUser = userState[1];
  var value = useMemo(function() {
    return { currentUser: currentUser, setCurrentUser: setCurrentUser };
  }, [currentUser]);
  return React.createElement(UserContext.Provider, { testID: 'Provider-1', value: value }, props.children);
};

export const useUser = function() { return useContext(UserContext); };
