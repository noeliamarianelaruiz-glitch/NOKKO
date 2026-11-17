import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const EXPENSES_STORAGE_KEY = 'nokko_expenses_v3';
export const BUDGET_LIMIT_STORAGE_KEY = 'nokko_limit_v2';

export const GastoRepository = {
  loadPersistedData: async () => {
    const keys = [EXPENSES_STORAGE_KEY, BUDGET_LIMIT_STORAGE_KEY];
    if (Platform.OS === 'web') {
      return keys.map((key) => window.localStorage.getItem(key));
    }
    const storedItems = await AsyncStorage.multiGet(keys);
    return storedItems.map(([, value]) => value);
  },
  savePersistedData: async (expenses, budgetLimit) => {
    const values = [
      [EXPENSES_STORAGE_KEY, JSON.stringify(expenses)],
      [BUDGET_LIMIT_STORAGE_KEY, String(budgetLimit)],
    ];
    if (Platform.OS === 'web') {
      values.forEach(([key, value]) => window.localStorage.setItem(key, value));
      return;
    }
    await AsyncStorage.multiSet(values);
  }
};
