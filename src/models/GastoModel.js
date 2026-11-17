export class GastoModel {
  constructor({ id, description, amount, category, date }) {
    this.id = id || Date.now().toString();
    this.description = String(description || '').trim();
    this.amount = Number(amount);
    this.category = category;
    this.date = date;
  }
}
