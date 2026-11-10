import { database } from '../database'

export default class TransactionSource {
  static run<T>(action: () => T): T {
    return database.transaction(action)()
  }
}
