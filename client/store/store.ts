import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import themeReducer from "./slices/themeSlice";
import calendarReducer from "./slices/calendarSlice";
import notificationReducer from "./slices/notificationSlice";
import plaidReducer from "./slices/plaidSlice";
import api from "./api/apiSlice";
import { apiCachePersistenceMiddleware } from "./api/cachePersistence";

// Configure the store
export const store = configureStore({
  reducer: {
    user: userReducer,
    [api.reducerPath]: api.reducer,
    calendar: calendarReducer,
    theme: themeReducer,
    notifications: notificationReducer,
    plaid: plaidReducer,
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

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export the store as default
export default store;
