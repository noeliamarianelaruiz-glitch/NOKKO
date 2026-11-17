import { GastoModel } from '../models/GastoModel';
import { GastoRepository } from '../repositories/GastoRepository';

export const GastoController = {
  cargarDatos: () => GastoRepository.loadPersistedData(),
  guardarDatos: (expenses, budgetLimit) => GastoRepository.savePersistedData(expenses, budgetLimit),
  crearGasto: (description, amount, category, date) => new GastoModel({ description, amount, category, date }),
  eliminarGasto: (expenses, id) => expenses.filter((item) => item.id !== id)
};
