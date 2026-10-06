import { configureStore, combineReducers } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import themeReducer from "./slices/themeSlice";
import calendarReducer from "./slices/calendarSlice";
import notificationReducer from "./slices/notificationSlice";
import plaidReducer from "./slices/plaidSlice";
import api from "./api/apiSlice";
import { apiCachePersistenceMiddleware } from "./api/cachePersistence";
import { registerSessionReset } from "@/utils/session";

const appReducer = combineReducers({
  user: userReducer,
  [api.reducerPath]: api.reducer,
  calendar: calendarReducer,
  theme: themeReducer,
  notifications: notificationReducer,
  plaid: plaidReducer,
});

// Reset every user-owned slice together while retaining the device's theme.
export const store = configureStore({
  reducer: (state: ReturnType<typeof appReducer> | undefined, action: any) => {
    if (action.type === "session/invalidated") {
      return appReducer(state ? { ...appReducer(undefined, action), theme: state.theme } : undefined, action);
    }
    return appReducer(state, action);
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializability check
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }).concat(api.middleware, apiCachePersistenceMiddleware.middleware),
  devTools: __DEV__, // Enable Redux DevTools in development only
});

registerSessionReset(() => {
  store.dispatch({ type: "session/invalidated" });
  store.dispatch(api.util.resetApiState());
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export the store as default
export default store;
