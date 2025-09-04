import { timeEntries } from "@database/schema";

export type TimeEntry = typeof timeEntries.$inferSelect;
export type CreateTimeEntry = typeof timeEntries.$inferInsert;

