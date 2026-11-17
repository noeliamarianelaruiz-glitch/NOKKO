import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';

import {
  COLORS,
  CATEGORIES,
  CATEGORY_DOTS,
  getLocalIsoDate,
  parseCleanNumber,
  formatMoney,
  HeaderNokko,
  ResumenTotal,
  DesgloseCategorias,
  GraficoCategorias,
  ModalTope,
  SnackbarAviso,
} from './ModuloResumen';

const EXPENSES_STORAGE_KEY = 'nokko_expenses_v3';
const BUDGET_LIMIT_STORAGE_KEY = 'nokko_limit_v2';

const loadPersistedData = async () => {
  const keys = [EXPENSES_STORAGE_KEY, BUDGET_LIMIT_STORAGE_KEY];
  if (Platform.OS === 'web') {
    return keys.map((key) => window.localStorage.getItem(key));
  }
  const storedItems = await AsyncStorage.multiGet(keys);
  return storedItems.map(([, value]) => value);
};

const savePersistedData = async (expenses, budgetLimit) => {
  const values = [
    [EXPENSES_STORAGE_KEY, JSON.stringify(expenses)],
    [BUDGET_LIMIT_STORAGE_KEY, String(budgetLimit)],
  ];
  if (Platform.OS === 'web') {
    values.forEach(([key, value]) => window.localStorage.setItem(key, value));
    return;
  }
  await AsyncStorage.multiSet(values);
};

export default function App() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const isCompactScreen = width < 380;
  const [expenses, setExpenses] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate(0));
  const [editingId, setEditingId] = useState(null);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState('Todas');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [budgetLimit, setBudgetLimit] = useState(50000);
  const [searchQuery, setSearchQuery] = useState('');

  const [descError, setDescError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState('50000');

  const [snackbar, setSnackbar] = useState({ visible: false, text: '', canUndo: false });
  const [lastDeleted, setLastDeleted] = useState(null);
  const [activeNavigation, setActiveNavigation] = useState('inicio');
  const snackTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionOffsetsRef = useRef({ columns: 0, movements: 0, categories: 0 });

  const scrollToSection = (section) => {
    setActiveNavigation(section);
    if (scrollRef.current) {
      const offset = section === 'inicio' ? 0 : sectionOffsetsRef.current[section];
      scrollRef.current.scrollTo({ y: offset, animated: true });
    }
  };

  const updateActiveNavigation = (offset) => {
    const { movements, categories } = sectionOffsetsRef.current;
    const section =
      categories > 0 && offset >= categories - 100
        ? 'categorias'
        : movements > 0 && offset >= movements - 100
        ? 'movimientos'
        : 'inicio';
    setActiveNavigation((active) => (active === section ? active : section));
  };

  const showNotice = (text, canUndo = false) => {
    if (snackTimerRef.current) clearTimeout(snackTimerRef.current);
    setSnackbar({ visible: true, text, canUndo });
    snackTimerRef.current = setTimeout(() => {
      setSnackbar({ visible: false, text: '', canUndo: false });
    }, 4000);
  };

  useEffect(() => {
    let isMounted = true;
    const restoreSavedData = async () => {
      try {
        const [storedExpenses, storedBudgetLimit] = await loadPersistedData();
        if (!isMounted) return;

        if (storedExpenses !== null) {
          const parsedExpenses = JSON.parse(storedExpenses);
          if (
            !Array.isArray(parsedExpenses) ||
            parsedExpenses.some(
              (item) =>
                !item ||
                typeof item !== 'object' ||
                typeof (item.description || item.desc) !== 'string' ||
                !Number.isFinite(Number(item.amount))
            )
          ) {
            throw new Error('Los movimientos guardados no tienen un formato válido.');
          }
          setExpenses(
            parsedExpenses.map(({ desc, ...item }) => ({
              ...item,
              description: item.description || desc,
            }))
          );
        }

        const parsedBudgetLimit = parseCleanNumber(storedBudgetLimit);
        if (Number.isFinite(parsedBudgetLimit) && parsedBudgetLimit > 0) {
          setBudgetLimit(parsedBudgetLimit);
        }
        setStorageReady(true);
      } catch (error) {
        console.error('No se pudieron cargar los datos guardados.', error);
        if (isMounted) {
          showNotice('No se pudieron cargar los datos guardados.');
        }
      }
    };

    restoreSavedData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    savePersistedData(expenses, budgetLimit).catch((error) => {
      console.error('No se pudieron guardar los datos.', error);
      showNotice('No se pudieron guardar los datos.');
    });
  }, [expenses, budgetLimit, storageReady]);

  const isWithinPeriod = (dateStr) => {
    if (periodFilter === 'all' || !dateStr) return true;
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return true;
    const itemDate = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (periodFilter === 'month') {
      return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth();
    }
    if (periodFilter === 'week') {
      const diffMs = today.getTime() - itemDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }
    return true;
  };

  const filteredExpenses = expenses
    .filter((item) => {
      const matchPeriod = isWithinPeriod(item.date);
      const matchCategory = activeCategoryFilter === 'Todas' || item.category === activeCategoryFilter;
      const matchSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchPeriod && matchCategory && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      if ((b.date || '') !== (a.date || '')) return (b.date || '').localeCompare(a.date || '');
      return 0;
    });

  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const budgetPercentage = budgetLimit > 0 ? Math.round((totalAmount / budgetLimit) * 100) : 0;

  const maxExpense =
    filteredExpenses.length > 0
      ? filteredExpenses.reduce((max, curr) => (curr.amount > max.amount ? curr : max), filteredExpenses[0])
      : null;

  const totalsByCategory = CATEGORIES.map((cat) => {
    const sum = filteredExpenses
      .filter((item) => item.category === cat)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const pct = totalAmount > 0 ? Math.round((sum / totalAmount) * 100) : 0;
    return { category: cat, total: sum, percentage: pct };
  }).filter((entry) => entry.total > 0);

  const exitEditMode = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setSelectedDate(getLocalIsoDate(0));
    setDescError('');
    setAmountError('');
  };

  const handleSaveExpense = () => {
    if (!storageReady) {
      showNotice('Cargando los datos guardados. Intenta guardar en un momento.');
      return;
    }

    const trimmedDesc = description.trim();
    const parsedAmount = parseCleanNumber(amount);
    let valid = true;

    if (!trimmedDesc) {
      setDescError('Escribe un concepto válido.');
      valid = false;
    } else {
      setDescError('');
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Escribe un monto numérico mayor a 0.');
      valid = false;
    } else {
      setAmountError('');
    }

    if (!valid) return;

    const cleanDate = selectedDate.trim() || getLocalIsoDate(0);

    if (editingId) {
      setExpenses(
        expenses.map((item) =>
          item.id === editingId
            ? { ...item, description: trimmedDesc, amount: parsedAmount, category: selectedCategory, date: cleanDate }
            : item
        )
      );
      exitEditMode();
      showNotice('Cambios guardados', false);
    } else {
      const newExpense = {
        id: Date.now().toString(),
        description: trimmedDesc,
        amount: parsedAmount,
        category: selectedCategory,
        date: cleanDate,
      };
      setExpenses([newExpense, ...expenses]);
      exitEditMode();
      showNotice(`Gasto guardado (${formatMoney(parsedAmount)})`, false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(String(item.amount));
    setSelectedCategory(item.category);
    setSelectedDate(item.date || getLocalIsoDate(0));
    setDescError('');
    setAmountError('');
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 180, animated: true });
    }
  };

  const handleDeleteExpense = (id) => {
    const idx = expenses.findIndex((item) => item.id === id);
    if (idx !== -1) {
      setLastDeleted({ item: expenses[idx], index: idx });
    }
    if (editingId === id) {
      exitEditMode();
    }
    setExpenses(expenses.filter((item) => item.id !== id));
    showNotice('Movimiento eliminado', true);
  };

  const handleUndoDelete = () => {
    if (!lastDeleted) return;
    const copy = [...expenses];
    copy.splice(lastDeleted.index, 0, lastDeleted.item);
    setExpenses(copy);
    setLastDeleted(null);
    setSnackbar({ visible: false, text: '', canUndo: false });
  };

  const handleSaveLimit = () => {
    if (!storageReady) {
      showNotice('Cargando los datos guardados. Intenta nuevamente en un momento.');
      return;
    }

    const parsed = parseCleanNumber(newLimitInput);
    if (!isNaN(parsed) && parsed > 0) {
      setBudgetLimit(parsed);
      setIsLimitModalVisible(false);
      showNotice(`Tope actualizado a ${formatMoney(parsed)}`, false);
    }
  };

  const todayIso = getLocalIsoDate(0);
  const yesterdayIso = getLocalIsoDate(-1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.nauticalNavy} />

      <HeaderNokko />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={isWideScreen ? styles.scrollContentWide : styles.scrollContentMobile}
        onScroll={(event) => updateActiveNavigation(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <View style={styles.content}>
        <View onLayout={(event) => { sectionOffsetsRef.current.summary = event.nativeEvent.layout.y; }}>
        <ResumenTotal
          totalAmount={totalAmount}
          amount={amount}
          movementsCount={filteredExpenses.length}
          budgetLimit={budgetLimit}
          budgetPercentage={budgetPercentage}
          maxExpense={maxExpense}
          onChangeAmount={setAmount}
          onOpenLimit={() => {
            setNewLimitInput(String(budgetLimit));
            setIsLimitModalVisible(true);
          }}
        />
        </View>

        <View
          style={isWideScreen ? styles.desktopColumns : null}
          onLayout={(event) => {
            sectionOffsetsRef.current.columns = event.nativeEvent.layout.y;
          }}
        >
          <View style={isWideScreen ? styles.desktopLeftColumn : null}>
        <View style={[styles.card, editingId ? styles.cardEditing : null]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>{editingId ? 'EDITAR GASTO' : 'NUEVO GASTO'}</Text>
            {editingId ? (
              <View style={styles.editingBadge}>
                <Text style={styles.editingBadgeText}>EDITANDO</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.inputLabel}>Concepto</Text>
          <TextInput
            style={[styles.textInput, descError ? styles.inputErrorBorder : null]}
            placeholder="Supermercado, Nafta, Café..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={(val) => {
              setDescription(val);
              if (descError) setDescError('');
            }}
          />
          {descError ? <Text style={styles.errorText}>{descError}</Text> : null}

          <Text style={styles.inputLabel}>Monto ($)</Text>
          <TextInput
            style={[styles.textInput, amountError ? styles.inputErrorBorder : null]}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(val) => {
              setAmount(val);
              if (amountError) setAmountError('');
            }}
          />
          {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

          <Text style={styles.inputLabel}>Fecha</Text>
          <View style={styles.dateSelectorRow}>
            <TouchableOpacity
              style={[styles.datePresetBtn, selectedDate === todayIso && styles.datePresetBtnActive]}
              onPress={() => setSelectedDate(todayIso)}
            >
              <Text style={[styles.datePresetText, selectedDate === todayIso && styles.datePresetTextActive]}>Hoy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.datePresetBtn, selectedDate === yesterdayIso && styles.datePresetBtnActive]}
              onPress={() => setSelectedDate(yesterdayIso)}
            >
              <Text style={[styles.datePresetText, selectedDate === yesterdayIso && styles.datePresetTextActive]}>Ayer</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.textInput, { flex: 1, paddingVertical: 6, fontSize: 13 }]}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              value={selectedDate}
              onChangeText={setSelectedDate}
            />
          </View>

          <Text style={styles.inputLabel}>Categoría</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[cat] }]} />
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formActionsRow}>
            {editingId ? (
              <TouchableOpacity style={styles.btnCancelEdit} onPress={exitEditMode}>
                <Text style={styles.btnCancelEditText}>CANCELAR</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={handleSaveExpense}>
              <Text style={styles.btnPrimaryText}>{editingId ? 'ACTUALIZAR' : 'GUARDAR'}</Text>
            </TouchableOpacity>
          </View>
        </View>

            {isWideScreen ? <DesgloseCategorias totalsByCategory={totalsByCategory} /> : null}
          </View>

          <View
            style={isWideScreen ? styles.desktopRightColumn : null}
            onLayout={(event) => {
              sectionOffsetsRef.current.movements =
                sectionOffsetsRef.current.columns + event.nativeEvent.layout.y;
            }}
          >
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>MOVIMIENTOS</Text>
            <GraficoCategorias totalsByCategory={totalsByCategory} />

          <View style={styles.periodRow}>
            {[
              { id: 'all', label: 'Todo' },
              { id: 'month', label: 'Este mes' },
              { id: 'week', label: '7 días' },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.periodBtn, periodFilter === p.id && styles.periodBtnActive]}
                onPress={() => setPeriodFilter(p.id)}
              >
                <Text style={[styles.periodBtnText, periodFilter === p.id && styles.periodBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.searchSortRow, isCompactScreen ? styles.searchSortCompact : null]}>
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity style={styles.btnClearSearch} onPress={() => setSearchQuery('')}>
                  <Text style={styles.btnClearSearchText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.sortToggleBtn}
              onPress={() => setSortBy(sortBy === 'recent' ? 'amount' : 'recent')}
            >
              <Text style={styles.sortToggleText}>
                {sortBy === 'recent' ? 'Orden: Recientes' : 'Orden: Mayor monto'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['Todas', ...CATEGORIES].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterBtn, activeCategoryFilter === filter && styles.filterBtnActive]}
                onPress={() => setActiveCategoryFilter(filter)}
              >
                {filter !== 'Todas' && (
                  <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[filter], marginRight: 5 }]} />
                )}
                <Text style={[styles.filterBtnText, activeCategoryFilter === filter && styles.filterBtnTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Sin movimientos.</Text>
            </View>
          ) : (
            filteredExpenses.map((item) => (
              <View key={item.id} style={styles.expenseItem}>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.categoryBadge}>
                      <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[item.category] || '#64748B' }]} />
                      <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                    {item.date ? <Text style={styles.dateText}>{item.date}</Text> : null}
                  </View>
                </View>

                <View style={styles.expenseActionCol}>
                  <Text style={styles.expenseAmount}>{formatMoney(item.amount)}</Text>
                  <View style={styles.actionBtnsGroup}>
                    <TouchableOpacity style={styles.btnEdit} onPress={() => handleStartEdit(item)}>
                      <Text style={styles.btnEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeleteExpense(item.id)}>
                      <Text style={styles.btnDeleteText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
          </View>
        </View>

        {!isWideScreen ? (
          <View onLayout={(event) => { sectionOffsetsRef.current.categories = event.nativeEvent.layout.y; }}>
            <DesgloseCategorias totalsByCategory={totalsByCategory} />
          </View>
        ) : null}

        <View style={styles.authorFooter}>
          <Text style={styles.authorFooterText}>
            <Text style={styles.bold}>NOKKO</Text> v1.0 · by <Text style={styles.bold}>Marianela Ruiz</Text> · © 2026
          </Text>
        </View>
        </View>
      </ScrollView>

      {!isWideScreen ? (
        <View style={styles.bottomNavigation}>
          {[
            { id: 'inicio', label: 'Inicio' },
            { id: 'movimientos', label: 'Movimientos' },
            { id: 'categorias', label: 'Categorías' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.bottomNavigationItem,
                activeNavigation === item.id ? styles.bottomNavigationItemActive : null,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: activeNavigation === item.id }}
              onPress={() => scrollToSection(item.id)}
            >
              <Text
                style={[
                  styles.bottomNavigationText,
                  activeNavigation === item.id ? styles.bottomNavigationTextActive : null,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <SnackbarAviso snackbar={snackbar} onUndo={handleUndoDelete} />

      <ModalTope
        visible={isLimitModalVisible}
        newLimitInput={newLimitInput}
        setNewLimitInput={setNewLimitInput}
        onCancel={() => setIsLimitModalVisible(false)}
        onSave={handleSaveLimit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.silkyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContentMobile: { padding: 16, paddingBottom: 112 },
  scrollContentWide: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 70, alignItems: 'center' },
  content: { width: '100%', maxWidth: 1180 },
  desktopColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  desktopLeftColumn: { flex: 0.9, minWidth: 0 },
  desktopRightColumn: { flex: 1.1, minWidth: 0 },
  bottomNavigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 10,
  },
  bottomNavigationItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  bottomNavigationItemActive: { borderTopColor: COLORS.soothingLime },
  bottomNavigationText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  bottomNavigationTextActive: { color: COLORS.nauticalNavy, fontWeight: '800' },
  bold: { fontWeight: '700', color: COLORS.nauticalNavy },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  cardEditing: {
    borderWidth: 2,
    borderColor: COLORS.nauticalNavy,
    backgroundColor: '#FAF9F4',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.nauticalNavy, letterSpacing: 0.5 },
  editingBadge: {
    backgroundColor: COLORS.soothingLime,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editingBadgeText: { color: COLORS.nauticalNavy, fontSize: 10, fontWeight: '800' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: COLORS.nauticalNavy, marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  textInput: {
    backgroundColor: COLORS.silkyWhite,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.nauticalNavy,
  },
  inputErrorBorder: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 11, fontWeight: '600', marginTop: 3 },
  dateSelectorRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  datePresetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.silkyWhite,
  },
  datePresetBtnActive: { backgroundColor: COLORS.nauticalNavy, borderColor: COLORS.nauticalNavy },
  datePresetText: { fontSize: 11, fontWeight: '700', color: COLORS.nauticalNavy },
  datePresetTextActive: { color: COLORS.soothingLime },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.silkyWhite,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  categoryChipActive: { backgroundColor: COLORS.nauticalNavy, borderColor: COLORS.nauticalNavy },
  categoryChipText: { fontSize: 12, color: COLORS.nauticalNavy, fontWeight: '600' },
  categoryChipTextActive: { color: COLORS.soothingLime },
  dotIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  formActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnPrimary: {
    backgroundColor: COLORS.soothingLime,
    borderWidth: 1,
    borderColor: '#CDE458',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: COLORS.nauticalNavy, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  btnCancelEdit: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancelEditText: { color: COLORS.nauticalNavy, fontSize: 12, fontWeight: '800' },
  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.silkyWhite,
  },
  periodBtnActive: { backgroundColor: COLORS.nauticalNavy, borderColor: COLORS.nauticalNavy },
  periodBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.nauticalNavy },
  periodBtnTextActive: { color: COLORS.soothingLime },
  searchSortRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  searchSortCompact: { flexDirection: 'column' },
  searchWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  searchInput: {
    backgroundColor: COLORS.silkyWhite,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingRight: 28,
    paddingVertical: 7,
    fontSize: 13,
    color: COLORS.nauticalNavy,
  },
  btnClearSearch: { position: 'absolute', right: 8, padding: 4 },
  btnClearSearchText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '700' },
  sortToggleBtn: {
    backgroundColor: COLORS.silkyWhite,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  sortToggleText: { color: COLORS.nauticalNavy, fontSize: 11, fontWeight: '700' },
  filterScroll: { marginBottom: 12 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
    backgroundColor: COLORS.silkyWhite,
  },
  filterBtnActive: { backgroundColor: COLORS.nauticalNavy, borderColor: COLORS.nauticalNavy },
  filterBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.nauticalNavy },
  filterBtnTextActive: { color: COLORS.soothingLime },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '700', color: COLORS.nauticalNavy, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.nauticalNavy, textTransform: 'uppercase' },
  dateText: { fontSize: 11, color: COLORS.textMuted },
  expenseActionCol: { alignItems: 'flex-end', marginLeft: 12 },
  expenseAmount: { fontSize: 15, fontWeight: '800', color: COLORS.nauticalNavy, marginBottom: 4 },
  actionBtnsGroup: { flexDirection: 'row', gap: 5 },
  btnEdit: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  btnEditText: { color: COLORS.nauticalNavy, fontSize: 11, fontWeight: '700' },
  btnDelete: { backgroundColor: COLORS.dangerBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  btnDeleteText: { color: COLORS.danger, fontSize: 11, fontWeight: '700' },
  emptyContainer: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  authorFooter: {
    marginTop: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  authorFooterText: { fontSize: 11, color: COLORS.textMuted },
});