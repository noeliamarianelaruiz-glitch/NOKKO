import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';

export const COLORS = {
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

export const CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Servicios',
  'Educación',
  'Otros',
];

export const CATEGORY_DOTS = {
  'Alimentación': '#365314',
  'Transporte': '#2563EB',
  'Entretenimiento': '#D97706',
  'Salud': '#DC2626',
  'Servicios': '#7C3AED',
  'Educación': '#0F766E',
  'Otros': '#64748B',
};

export const getLocalIsoDate = (daysOffset = 0) => {
  const d = new Date();
  if (daysOffset) {
    d.setDate(d.getDate() + daysOffset);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const parseCleanNumber = (rawStr) => {
  if (!rawStr) return NaN;
  let clean = String(rawStr).trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      const decimalPart = parts.pop();
      clean = parts.join('') + (decimalPart.length <= 2 ? `.${decimalPart}` : decimalPart);
    } else if (parts[1].length === 3) {
      clean = parts.join('');
    }
  }
  return parseFloat(clean);
};

export const formatMoney = (val) =>
  '$' + (Number(val) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function HeaderNokko() {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.headerTitle}>NOKKO</Text>
          <Text style={styles.headerSubtitle}>CONTROL DE GASTOS</Text>
        </View>
      </View>
    </View>
  );
}

export function ResumenTotal({
  totalAmount,
  amount,
  movementsCount,
  budgetLimit,
  budgetPercentage,
  maxExpense,
  onOpenLimit,
  onChangeAmount,
}) {
  return (
    <>
      <View style={styles.totalCard}>
        <View style={styles.totalTopRow}>
          <Text style={styles.totalLabel}>TOTAL A AGREGAR</Text>
          <TouchableOpacity onPress={onOpenLimit}>
            <Text style={styles.editLimitLink}>
              Establecer monto tope: {formatMoney(budgetLimit)}
            </Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.totalValue}
          accessibilityLabel="Importe a agregar"
          placeholder="0"
          placeholderTextColor="#A8C94E"
          keyboardType="decimal-pad"
          underlineColorAndroid="transparent"
          value={amount}
          onChangeText={onChangeAmount}
        />
        <Text style={styles.totalSub}>Acumulado: {formatMoney(totalAmount)}</Text>
        <Text style={styles.totalSub}>
          {movementsCount} movimiento{movementsCount === 1 ? '' : 's'}
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
                budgetPercentage >= 100
                  ? styles.barExceeded
                  : budgetPercentage >= 80
                  ? styles.barWarning
                  : null,
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
          <Text style={[styles.maxExpenseText, styles.bold]}>
            {formatMoney(maxExpense.amount)}
          </Text>
        </View>
      )}
    </>
  );
}

export function DesgloseCategorias({ totalsByCategory }) {
  if (totalsByCategory.length === 0) return null;

  return (
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
  );
}

export function GraficoCategorias({ totalsByCategory }) {
  const total = totalsByCategory.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <View style={styles.categoryChart}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Distribución por categoría</Text>
          <Text style={styles.chartSubtitle}>Del gasto mostrado</Text>
        </View>
        <Text style={styles.chartTotal}>{formatMoney(total)}</Text>
      </View>

      {total > 0 ? (
        <>
          <View style={styles.chartBarTrack}>
            {totalsByCategory.map((entry) => (
              <View
                key={entry.category}
                style={[
                  styles.chartBarSegment,
                  {
                    width: `${(entry.total / total) * 100}%`,
                    backgroundColor: CATEGORY_DOTS[entry.category] || '#64748B',
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.chartLegend}>
            {totalsByCategory.map((entry) => (
              <View key={entry.category} style={styles.chartLegendRow}>
                <View style={styles.chartLegendCategory}>
                  <View
                    style={[
                      styles.dotIndicator,
                      { backgroundColor: CATEGORY_DOTS[entry.category] || '#64748B' },
                    ]}
                  />
                  <Text style={styles.chartLegendText} numberOfLines={1}>
                    {entry.category} ({Math.round((entry.total / total) * 100)}%)
                  </Text>
                </View>
                <Text style={styles.chartLegendAmount}>{formatMoney(entry.total)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.chartEmptyText}>Agrega un movimiento para ver la distribución.</Text>
      )}
    </View>
  );
}

export function ModalTope({ visible, newLimitInput, setNewLimitInput, onCancel, onSave }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.sectionTitle}>ESTABLECER MONTO TOPE</Text>
          <Text style={styles.inputLabel}>Monto ($)</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="decimal-pad"
            value={newLimitInput}
            onChangeText={setNewLimitInput}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.periodBtn, { paddingVertical: 10 }]} onPress={onCancel}>
              <Text style={styles.periodBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { flex: 1, marginTop: 0, paddingVertical: 10 }]}
              onPress={onSave}
            >
              <Text style={styles.btnPrimaryText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SnackbarAviso({ snackbar, onUndo }) {
  if (!snackbar.visible) return null;
  return (
    <View style={styles.snackbar}>
      <Text style={styles.snackbarText}>{snackbar.text}</Text>
      {snackbar.canUndo ? (
        <TouchableOpacity style={styles.btnUndo} onPress={onUndo}>
          <Text style={styles.btnUndoText}>DESHACER</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.nauticalNavy,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.soothingLime,
  },
  headerContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: COLORS.silkyWhite, fontSize: 23, fontWeight: '800', letterSpacing: 1.5 },
  headerSubtitle: { color: COLORS.floralBlue, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  totalCard: {
    backgroundColor: COLORS.nauticalNavy,
    borderRadius: 10,
    padding: 18,
    marginBottom: 12,
  },
  totalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: COLORS.floralBlue, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  editLimitLink: { color: COLORS.soothingLime, fontSize: 12, textDecorationLine: 'underline', fontWeight: '600' },
  totalValue: {
    color: COLORS.soothingLime,
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 2,
    height: 42,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
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
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.nauticalNavy, letterSpacing: 0.5 },
  dotIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  breakdownRow: { marginBottom: 10 },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakdownCatName: { fontSize: 12, fontWeight: '700', color: COLORS.nauticalNavy },
  breakdownCatTotal: { fontSize: 12, fontWeight: '800', color: COLORS.nauticalNavy },
  breakdownBarBg: { height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', backgroundColor: COLORS.nauticalNavy, borderRadius: 3 },
  categoryChart: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  chartTitle: { color: COLORS.nauticalNavy, fontSize: 12, fontWeight: '800' },
  chartSubtitle: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  chartTotal: { color: COLORS.nauticalNavy, fontSize: 12, fontWeight: '800' },
  chartBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: 10,
  },
  chartBarSegment: { height: '100%' },
  chartLegend: { gap: 7 },
  chartLegendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chartLegendCategory: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  chartLegendText: { color: COLORS.nauticalNavy, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  chartLegendAmount: { color: COLORS.nauticalNavy, fontSize: 11, fontWeight: '800' },
  chartEmptyText: { color: COLORS.textMuted, fontSize: 11, paddingVertical: 5 },
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
  periodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.silkyWhite,
  },
  periodBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.nauticalNavy },
  btnPrimary: {
    backgroundColor: COLORS.soothingLime,
    borderWidth: 1,
    borderColor: '#CDE458',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: COLORS.nauticalNavy, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
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