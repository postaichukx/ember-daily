import {sqliteTable, text, integer, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
export const userState = sqliteTable('user_state', {
  userId: text('user_id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull()
});
export const emailAccounts = sqliteTable('email_accounts', {
  email: text('email').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at').notNull()
}, table => [uniqueIndex('email_accounts_user_id').on(table.userId)]);
export const authChallenges = sqliteTable('auth_challenges', {
  email: text('email').primaryKey(), challenge: text('challenge').notNull(),
  codeHash: text('code_hash').notNull(), expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumed: integer('consumed').notNull().default(0), delivered: integer('delivered').notNull().default(0)
});
export const authSessions = sqliteTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull(),
  email: text('email').notNull(), createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull()
}, table => [index('auth_sessions_expiry').on(table.expiresAt)]);
export const authLimits = sqliteTable('auth_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), expiresAt: integer('expires_at').notNull()
}, table => [index('auth_limits_expiry').on(table.expiresAt)]);
export const widgetTokens = sqliteTable('widget_tokens', {
  userId: text('user_id').primaryKey(), tokenHash: text('token_hash').notNull(),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull()
}, table => [uniqueIndex('widget_tokens_hash').on(table.tokenHash)]);
