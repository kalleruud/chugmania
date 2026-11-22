import { eq } from 'drizzle-orm'
import db from '../database'
import { plannedResultAssignments } from '../schema'

export type PlannedResultAssignment =
  typeof plannedResultAssignments.$inferSelect

export default class PlannedResultAssignmentSource {
  static find(capture: string): PlannedResultAssignment | undefined {
    return db
      .select()
      .from(plannedResultAssignments)
      .where(eq(plannedResultAssignments.capture, capture))
      .get()
  }

  static create(assignment: PlannedResultAssignment): void {
    db.insert(plannedResultAssignments).values(assignment).run()
  }
}
