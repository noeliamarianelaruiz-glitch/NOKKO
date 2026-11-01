import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Button,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Platform,
} from 'react-native';

const COLORS = {
  nauticalNavy: '#18233F',
  floralBlue: '#92BAD4',
  silkyWhite: '#F7F3E7',
  soothingLime: '#E0F479',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE0',
  border: '#DFD8C7',
  textMuted: '#57627B',
  danger: '#991B1B',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
};

const CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Servicios',
  'Educación',
  'Otros',
];

const CATEGORY_DOTS = {
  'Alimentación': '#365314',
  'Transporte': '#2563EB',
  'Entretenimiento': '#D97706',
  'Salud': '#DC2626',
  'Servicios': '#7C3AED',
  'Educación': '#0F766E',
  'Otros': '#64748B',
};

const getLocalIsoDate = (daysOffset = 0) => {
  const d = new Date();
  if (daysOffset) {
    d.setDate(d.getDate() + daysOffset);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const SAMPLE_TP_EXPENSES = [
  { id: '1', description: 'Supermercado', amount: 15000, category: 'Alimentación', date: getLocalIsoDate(-2) },
  { id: '2', description: 'Nafta', amount: 20000, category: 'Transporte', date: getLocalIsoDate(-1) },
  { id: '3', description: 'Café', amount: 3500, category: 'Alimentación', date: getLocalIsoDate(0) },
];
const INITIAL_EXPENSES = [];

const parseCleanNumber = (rawStr) => {
  if (!rawStr) return NaN;
  let clean = String(rawStr).trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean);
};

export default function App() {
  const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedDate, setSelectedDate] = useState(getLocalIsoDate(0));
  const [editingId, setEditingId] = useState(null);
  
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('Todas');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'amount'
  const [budgetLimit, setBudgetLimit] = useState(50000);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [descError, setDescError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState('50000');

  const [snackbar, setSnackbar] = useState({ visible: false, text: '', canUndo: false });
  const [lastDeleted, setLastDeleted] = useState(null);
  const snackTimerRef = useRef(null);
  const scrollRef = useRef(null);

  const showNotice = (text, canUndo = false) => {
    if (snackTimerRef.current) clearTimeout(snackTimerRef.current);
    setSnackbar({ visible: true, text, canUndo });
    snackTimerRef.current = setTimeout(() => {
      setSnackbar({ visible: false, text: '', canUndo: false });
    }, 4000);
  };

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
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      if ((b.date || '') !== (a.date || '')) {
        return (b.date || '').localeCompare(a.date || '');
      }
      return 0;
    });

  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const budgetPercentage = budgetLimit > 0 ? Math.round((totalAmount / budgetLimit) * 100) : 0;

  const maxExpense = filteredExpenses.length > 0
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

  const handleResetExamples = () => {
    exitEditMode();
    setExpenses(SAMPLE_TP_EXPENSES);
    setActiveCategoryFilter('Todas');
    setPeriodFilter('all');
    setSearchQuery('');
    showNotice('Datos iniciales restaurados', false);
  };

  const handleSaveLimit = () => {
    const parsed = parseCleanNumber(newLimitInput);
    if (!isNaN(parsed) && parsed > 0) {
      setBudgetLimit(parsed);
      setIsLimitModalVisible(false);
      showNotice(`Tope actualizado a ${formatMoney(parsed)}`, false);
    }
  };

  const formatMoney = (val) =>
    '$' + (Number(val) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const todayIso = getLocalIsoDate(0);
  const yesterdayIso = getLocalIsoDate(-1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.nauticalNavy} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>NOKKO</Text>
        <TouchableOpacity style={styles.btnRestoreHeader} onPress={handleResetExamples}>
          <Text style={styles.btnRestoreHeaderText}>Datos de prueba</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.totalCard}>
          <View style={styles.totalTopRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <TouchableOpacity
              onPress={() => {
                setNewLimitInput(String(budgetLimit));
                setIsLimitModalVisible(true);
              }}
            >
              <Text style={styles.editLimitLink}>Tope: {formatMoney(budgetLimit)}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.totalValue}>{formatMoney(totalAmount)}</Text>
          <Text style={styles.totalSub}>
            {filteredExpenses.length} movimiento{filteredExpenses.length === 1 ? '' : 's'}
          </Text>
          
          <View style={styles.budgetBox}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetInfoText}>{budgetPercentage}% del tope</Text>
              <Text style={styles.budgetInfoText}>
                {budgetLimit - totalAmount >= 0 
                  ? `Disponible: ${formatMoney(budgetLimit - totalAmount)}`
                  : `Excedido: ${formatMoney(Math.abs(budgetLimit - totalAmount))}`}
              </Text>
            </View>
            <View style={styles.budgetBarTrack}>
              <View 
                style={[
                  styles.budgetBarFill, 
                  { width: `${Math.min(budgetPercentage, 100)}%` },
                  budgetPercentage >= 100 ? styles.barExceeded : (budgetPercentage >= 80 ? styles.barWarning : null)
                ]} 
              />
            </View>
          </View>
        </View>

        {maxExpense && totalAmount > 0 && (
          <View style={styles.maxExpenseBadge}>
            <Text style={styles.maxExpenseText}>
              Mayor gasto: <Text style={styles.bold}>{maxExpense.description}</Text>
            </Text>
            <Text style={[styles.maxExpenseText, styles.bold]}>{formatMoney(maxExpense.amount)}</Text>
          </View>
        )}

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
            placeholder="15000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
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
                style={[
                  styles.categoryChip,
                  selectedCategory === cat && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[cat] }]} />
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat && styles.categoryChipTextActive,
                  ]}
                >
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

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>MOVIMIENTOS</Text>

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

          <View style={styles.searchSortRow}>
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
                style={[
                  styles.filterBtn,
                  activeCategoryFilter === filter && styles.filterBtnActive,
                ]}
                onPress={() => setActiveCategoryFilter(filter)}
              >
                {filter !== 'Todas' && (
                  <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[filter], marginRight: 5 }]} />
                )}
                <Text
                  style={[
                    styles.filterBtnText,
                    activeCategoryFilter === filter && styles.filterBtnTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Sin movimientos.</Text>
              <View style={{ marginTop: 10 }}>
                <Button
                  title="Datos de prueba iniciales"
                  color={COLORS.nauticalNavy}
                  onPress={handleResetExamples}
                />
              </View>
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
                    <TouchableOpacity
                      style={styles.btnEdit}
                      onPress={() => handleStartEdit(item)}
                    >
                      <Text style={styles.btnEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDelete}
                      onPress={() => handleDeleteExpense(item.id)}
                    >
                      <Text style={styles.btnDeleteText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {totalsByCategory.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>POR CATEGORÍA</Text>
            {totalsByCategory.map((entry) => (
              <View key={entry.category} style={styles.breakdownRow}>
                <View style={styles.breakdownHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.dotIndicator, { backgroundColor: CATEGORY_DOTS[entry.category] }]} />
                    <Text style={styles.breakdownCatName}>{entry.category} ({entry.percentage}%)</Text>
                  </View>
                  <Text style={styles.breakdownCatTotal}>{formatMoney(entry.total)}</Text>
                </View>
                <View style={styles.breakdownBarBg}>
                  <View style={[styles.breakdownBarFill, { width: `${entry.percentage}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pie de firma minimalista (Opción 1A) */}
        <View style={styles.authorFooter}>
          <Text style={styles.authorFooterText}>
            <Text style={styles.bold}>NOKKO</Text> v1.0 · by <Text style={styles.bold}>Marianela Ruiz</Text> · © 2026
          </Text>
        </View>

      </ScrollView>

      {/* Snackbar para confirmación y Deshacer borrado */}
      {snackbar.visible ? (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackbar.text}</Text>
          {snackbar.canUndo ? (
            <TouchableOpacity style={styles.btnUndo} onPress={handleUndoDelete}>
              <Text style={styles.btnUndoText}>DESHACER</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={isLimitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.sectionTitle}>TOPE MENSUAL</Text>
            <Text style={styles.inputLabel}>Monto ($)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={newLimitInput}
              onChangeText={setNewLimitInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.periodBtn, { paddingVertical: 10 }]}
                onPress={() => setIsLimitModalVisible(false)}
              >
                <Text style={styles.periodBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1, marginTop: 0, paddingVertical: 10 }]}
                onPress={handleSaveLimit}
              >
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.silkyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: COLORS.nauticalNavy,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.soothingLime,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: COLORS.silkyWhite, fontSize: 24, fontWeight: '800', letterSpacing: 1.5 },
  btnRestoreHeader: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(146,186,212,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  btnRestoreHeaderText: { color: COLORS.floralBlue, fontSize: 11, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 70 },
  totalCard: {
    backgroundColor: COLORS.nauticalNavy,
    borderRadius: 10,
    padding: 18,
    marginBottom: 12,
  },
  totalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: COLORS.floralBlue, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  editLimitLink: { color: COLORS.soothingLime, fontSize: 12, textDecorationLine: 'underline', fontWeight: '600' },
  totalValue: { color: COLORS.soothingLime, fontSize: 32, fontWeight: '800', marginVertical: 2 },
  totalSub: { color: COLORS.silkyWhite, fontSize: 12, opacity: 0.85 },
  budgetBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetInfoText: { color: '#CBD5E1', fontSize: 11 },
  budgetBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  budgetBarFill: { height: '100%', backgroundColor: COLORS.soothingLime, borderRadius: 4 },
  barWarning: { backgroundColor: COLORS.warning },
  barExceeded: { backgroundColor: '#F87171' },
  maxExpenseBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maxExpenseText: { color: COLORS.nauticalNavy, fontSize: 12 },
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
  breakdownRow: { marginBottom: 10 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakdownCatName: { fontSize: 12, fontWeight: '700', color: COLORS.nauticalNavy },
  breakdownCatTotal: { fontSize: 12, fontWeight: '800', color: COLORS.nauticalNavy },
  breakdownBarBg: { height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', backgroundColor: COLORS.nauticalNavy, borderRadius: 3 },
  authorFooter: {
    marginTop: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  authorFooterText: { fontSize: 11, color: COLORS.textMuted },
  snackbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: COLORS.nauticalNavy,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.soothingLime,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 6,
  },
  snackbarText: { color: COLORS.silkyWhite, fontSize: 12, fontWeight: '600' },
  btnUndo: {
    backgroundColor: COLORS.soothingLime,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnUndoText: { color: COLORS.nauticalNavy, fontSize: 11, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24,35,63,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
});
