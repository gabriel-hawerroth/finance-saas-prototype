/**
 * Authentication & user endpoints of the mock backend (§8.1). E-mails are not sent;
 * they are delivered to a simulated inbox the demo UI can open.
 */
import { ApiError } from "@/domain/errors";
import { isPasswordValid } from "@/domain/password";
import type { Id, User, UserConfigs } from "@/domain/types";
import { currentUser, getDB, persist, setSessionUserId } from "./db";
import { buildStarterDataset } from "./seed";
import type { SimulatedEmail, StoredUser, TokenKind } from "./store";

const TOKEN_TTL: Record<TokenKind, number> = {
  ACTIVATION: 24 * 3600_000,
  RECOVERY: 3600_000,
  CANCEL: 24 * 3600_000,
};

export function toUser(u: StoredUser): User {
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName ?? null, access: u.access, active: u.active, subscriptionPlan: u.subscriptionPlan, provider: u.provider };
}

const authError = (status: number, errorDescription: string) => new ApiError(status, { errorDescription });

function findByEmail(email: string): StoredUser | undefined {
  return getDB().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function issueToken(userId: Id, kind: TokenKind): string {
  const db = getDB();
  db.tokens = db.tokens.filter((t) => !(t.userId === userId && t.kind === kind));
  const token = randomToken();
  db.tokens.push({ token, kind, userId, expiresAt: Date.now() + TOKEN_TTL[kind], used: false });
  return token;
}

function consumeToken(token: string, kind: TokenKind, markUsed: boolean) {
  const t = getDB().tokens.find((x) => x.token === token && x.kind === kind);
  if (!t || t.used || t.expiresAt < Date.now()) throw new ApiError(410, { errorDescription: "invalid token" });
  if (markUsed) t.used = true;
  return t;
}

function sendEmail(mail: Omit<SimulatedEmail, "id" | "sentAt" | "read">): void {
  getDB().inbox.unshift({ ...mail, id: randomToken().slice(0, 10), sentAt: Date.now(), read: false });
}

/* ───── simple rate limit (429) ───── */
const hits = new Map<string, number[]>();
function rateLimit(key: string, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new ApiError(429, { errorDescription: "too many requests" });
  list.push(now);
  hits.set(key, list);
}

/* ───── login / register ───── */

export function login(email: string, password: string): User {
  const u = findByEmail(email);
  if (!u) throw authError(401, "bad credentials");
  if (u.provider === "GOOGLE") throw authError(401, "use google to sign in");
  if (u.password !== password) throw authError(401, "bad credentials");
  if (!u.active) throw authError(401, "inactive user");
  setSessionUserId(u.id);
  return toUser(u);
}

/** Simulated Google sign-in: `credential` is the e-mail chosen in the fake account picker. */
export function googleLogin(credential: string, displayName: string): User {
  const db = getDB();
  let u = findByEmail(credential);
  if (u && u.provider === "LOCAL" && u.email !== credential) throw authError(401, "google account does not match the registered account");
  if (!u) {
    db.userSeq += 1;
    const [firstName, ...rest] = displayName.trim().split(/\s+/);
    u = {
      id: db.userSeq,
      email: credential,
      password: "",
      firstName: firstName || "Pessoa",
      lastName: rest.join(" ") || null,
      access: "BASIC",
      active: true,
      subscriptionPlan: "MONTHLY",
      provider: "GOOGLE",
      profileImage: null,
      configs: { theme: "system", language: "pt-BR", currency: "R$", showAuditFields: true },
    };
    db.users.push(u);
    db.datasets[u.id] = buildStarterDataset();
  }
  if (!u.active) u.active = true;
  setSessionUserId(u.id);
  persist();
  return toUser(u);
}

export function register(dto: { email: string; password: string; firstName: string; lastName?: string | null }): User {
  const db = getDB();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) throw authError(400, "invalid email");
  if (findByEmail(dto.email)) throw authError(400, "this email is already in use");
  if (!isPasswordValid(dto.password)) throw authError(400, "password policy");
  db.userSeq += 1;
  const u: StoredUser = {
    id: db.userSeq,
    email: dto.email.trim(),
    password: dto.password,
    firstName: dto.firstName.trim(),
    lastName: dto.lastName?.trim() || null,
    access: "BASIC",
    active: false,
    subscriptionPlan: "MONTHLY",
    provider: "LOCAL",
    profileImage: null,
    configs: { theme: "system", language: "pt-BR", currency: "R$", showAuditFields: true },
  };
  db.users.push(u);
  db.datasets[u.id] = buildStarterDataset();
  sendActivation(u);
  persist();
  return toUser(u);
}

function sendActivation(u: StoredUser) {
  const token = issueToken(u.id, "ACTIVATION");
  sendEmail({ to: u.email, subject: "Ative sua conta Finax", body: `Olá, ${u.firstName}! Confirme seu e-mail para começar a usar o Finax.`, link: `/ativacao-da-conta?token=${token}`, linkLabel: "Ativar minha conta" });
}

export function resendActivation(email: string): void {
  rateLimit(`activation:${email}`);
  const u = findByEmail(email);
  if (!u) return;
  if (u.active) throw authError(400, "user already active");
  sendActivation(u);
  persist();
}

/** Mock of the backend redirect that happens when the activation link is opened. */
export function activate(token: string): "ok" | "expired" | "error" {
  const t = getDB().tokens.find((x) => x.token === token && x.kind === "ACTIVATION");
  if (!t) return "error";
  if (t.used || t.expiresAt < Date.now()) return "expired";
  t.used = true;
  const u = getDB().users.find((x) => x.id === t.userId);
  if (!u) return "error";
  u.active = true;
  persist();
  return "ok";
}

export function logout(): void {
  setSessionUserId(null);
}

/* ───── password recovery ───── */

export function requestPasswordRecovery(email: string): void {
  rateLimit(`recovery:${email}`);
  const u = findByEmail(email);
  if (u && u.provider === "LOCAL") {
    const token = issueToken(u.id, "RECOVERY");
    sendEmail({ to: u.email, subject: "Redefina sua senha", body: "Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.", link: `/recuperacao-da-senha?rt=${token}`, linkLabel: "Definir nova senha" });
    persist();
  }
}

export function validateRecoveryToken(token: string): void {
  consumeToken(token, "RECOVERY", false);
}

export function confirmPasswordRecovery(token: string, newPassword: string): void {
  const t = consumeToken(token, "RECOVERY", false);
  if (!isPasswordValid(newPassword)) throw authError(400, "password policy");
  t.used = true;
  const u = getDB().users.find((x) => x.id === t.userId);
  if (u) u.password = newPassword;
  persist();
}

/* ───── account cancellation ───── */

export function sendCancelAccountEmail(): void {
  const u = currentUser();
  rateLimit(`cancel:${u.id}`, 3);
  const token = issueToken(u.id, "CANCEL");
  sendEmail({ to: u.email, subject: "Confirme o cancelamento da sua conta", body: "Você pediu para cancelar sua conta Finax. Se não foi você, ignore este e-mail.", link: `/cancelamento-da-conta?t=${token}`, linkLabel: "Revisar cancelamento" });
  persist();
}

export function cancelUser(token: string): void {
  const t = consumeToken(token, "CANCEL", true);
  const db = getDB();
  db.users = db.users.filter((u) => u.id !== t.userId);
  delete db.datasets[t.userId];
  db.tokens = db.tokens.filter((x) => x.userId !== t.userId);
  persist();
}

/* ───── profile & configs ───── */

export function me(): User {
  return toUser(currentUser());
}

export function updateUser(dto: { firstName: string; lastName?: string | null }): User {
  const u = currentUser();
  if (!dto.firstName.trim() || dto.firstName.trim().length > 30) throw authError(400, "invalid first name");
  if ((dto.lastName ?? "").length > 90) throw authError(400, "invalid last name");
  u.firstName = dto.firstName.trim();
  u.lastName = dto.lastName?.trim() || null;
  persist();
  return toUser(u);
}

export function changePassword(currentPassword: string, newPassword: string): User {
  const u = currentUser();
  if (u.password !== currentPassword) throw new ApiError(406, { errorDescription: "wrong current password" });
  if (!isPasswordValid(newPassword)) throw authError(400, "password policy");
  u.password = newPassword;
  persist();
  return toUser(u);
}

export function setProfileImage(dataUrl: string | null): User {
  const u = currentUser();
  u.profileImage = dataUrl;
  persist();
  return toUser(u);
}

export function profileImage(): string | null {
  return currentUser().profileImage;
}

export function getConfigs(): UserConfigs {
  return currentUser().configs;
}

export function saveConfigs(configs: UserConfigs): UserConfigs {
  const u = currentUser();
  u.configs = { ...configs };
  persist();
  return u.configs;
}

/* ───── simulated inbox ───── */

export function inbox(): SimulatedEmail[] {
  return getDB().inbox;
}

export function markEmailRead(id: string): void {
  const m = getDB().inbox.find((x) => x.id === id);
  if (m) m.read = true;
  persist();
}
