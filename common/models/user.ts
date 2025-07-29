import { users } from "../../backend/schema/users";

export type User = typeof users.$inferSelect;
export type CreateUser = typeof users.$inferInsert;
export type UserInfo = Omit<User, "passwordHash">;
