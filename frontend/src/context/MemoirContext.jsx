import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  sessionId: null,
  essay: '',          // accumulated streaming text
  structure: null,    // { chapters, locations }
  postcards: [],      // [{ index, url }]
  audioUrl: null,
  stats: null,        // { locations, days, photoCount, wordCount }
  progress: { stage: '', percent: 0, message: '' },
  isComplete: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SESSION':      return { ...state, sessionId: action.payload };
    case 'APPEND_TEXT':      return { ...state, essay: state.essay + action.payload };
    case 'SET_STRUCTURE':    return { ...state, structure: action.payload };
    case 'ADD_POSTCARD':     return { ...state, postcards: [...state.postcards, action.payload] };
    case 'SET_AUDIO':        return { ...state, audioUrl: action.payload };
    case 'SET_STATS':        return { ...state, stats: action.payload };
    case 'SET_PROGRESS':     return { ...state, progress: action.payload };
    case 'SET_COMPLETE':     return { ...state, isComplete: true };
    case 'SET_ERROR':        return { ...state, error: action.payload };
    case 'RESET':            return { ...initialState };
    default:                 return state;
  }
}

const MemoirContext = createContext(null);

export function MemoirProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <MemoirContext.Provider value={{ state, dispatch }}>
      {children}
    </MemoirContext.Provider>
  );
}

export function useMemoir() {
  const ctx = useContext(MemoirContext);
  if (!ctx) throw new Error('useMemoir must be used inside MemoirProvider');
  return ctx;
}
