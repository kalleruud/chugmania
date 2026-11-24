import { database } from '../database'

export default class TransactionSource {
  static run<T>(action: () => T, immediate = false): T {
    const transaction = database.transaction(action)
    return immediate ? transaction.immediate() : transaction()
  }
}
