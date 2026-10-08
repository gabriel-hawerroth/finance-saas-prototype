/** Business error codes returned by the API (§9.3). */
export type ErrorCode =
  | "LINKED_RELEASES"
  | "LINKED_REGISTERS"
  | "PAID_INVOICE"
  | "INVOICE_HAS_PAYMENT"
  | "PIGGY_BANK_NEGATIVE_BALANCE"
  | "EXPENSE_HAS_REIMBURSEMENTS"
  | "EXPENSE_BELOW_REIMBURSEMENTS"
  | "REIMBURSEMENT_EXCEEDS_EXPENSE"
  | "REIMBURSED_EXPENSE_NOT_DONE"
  | "REIMBURSED_EXPENSE_MUST_STAY_DONE";

export interface ApiErrorBody {
  code?: ErrorCode;
  errorDescription?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  readonly errorDescription?: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody = {}) {
    super(body.errorDescription ?? body.code ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.errorDescription = body.errorDescription;
    this.details = body.details;
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** Human message for a business error code (pt-BR). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  LINKED_RELEASES: "Existem lançamentos vinculados.",
  LINKED_REGISTERS: "Existem registros vinculados.",
  PAID_INVOICE: "A operação atinge uma fatura já paga.",
  INVOICE_HAS_PAYMENT: "A fatura já possui pagamento.",
  PIGGY_BANK_NEGATIVE_BALANCE: "O cofrinho está com saldo negativo. Corrija o saldo antes de arquivar.",
  EXPENSE_HAS_REIMBURSEMENTS: "Esta despesa tem reembolsos. Exclua os reembolsos antes.",
  EXPENSE_BELOW_REIMBURSEMENTS: "O valor da despesa não pode ficar abaixo do que já foi reembolsado.",
  REIMBURSEMENT_EXCEEDS_EXPENSE: "Os reembolsos somariam mais que o valor da despesa.",
  REIMBURSED_EXPENSE_NOT_DONE: "Só despesas realizadas podem receber reembolso.",
  REIMBURSED_EXPENSE_MUST_STAY_DONE: "Uma despesa com reembolso não pode voltar a pendente.",
};

export function errorMessage(error: unknown, fallback = "Não foi possível concluir. Tente novamente."): string {
  if (isApiError(error) && error.code) return ERROR_MESSAGES[error.code];
  return fallback;
}
