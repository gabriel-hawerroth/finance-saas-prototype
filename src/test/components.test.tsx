import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "@/components/ui/money-input";
import { TotalsStrip } from "@/features/cash-flow/totals-strip";
import { usePrefs } from "@/features/prefs/store";
import { ReleaseRow } from "@/features/releases/release-row";
import { release } from "@/domain/__tests__/fixtures";

beforeEach(() => {
  usePrefs.setState({ showValues: true, currency: "R$" });
});

function ControlledMoney({ allowNegative }: { allowNegative?: boolean }) {
  const [v, setV] = React.useState(0);
  return (
    <>
      <label htmlFor="m">Valor</label>
      <MoneyInput id="m" value={v} onValueChange={setV} allowNegative={allowNegative} />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe("MoneyInput", () => {
  it("types from the cents up", async () => {
    render(<ControlledMoney />);
    const input = screen.getByLabelText("Valor");
    await userEvent.type(input, "12345");
    expect(screen.getByTestId("value").textContent).toBe("123.45");
    expect(input).toHaveValue("123,45");
  });

  it("toggles the sign when negatives are allowed", async () => {
    render(<ControlledMoney allowNegative />);
    const input = screen.getByLabelText("Valor");
    await userEvent.type(input, "500");
    await userEvent.click(screen.getByRole("button", { name: "Tornar negativo" }));
    expect(screen.getByTestId("value").textContent).toBe("-5");
    expect(input).toHaveValue("−5,00");
  });
});

describe("ReleaseRow", () => {
  it("shows a signed amount and toggles realized status accessibly", async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    const r = release({ description: "Supermercado", amount: 87.5, done: false, account: { id: 1, name: "Nubank", active: true } });
    render(<ReleaseRow release={r} onOpen={onOpen} onToggleDone={onToggle} />);
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("−R$ 87,50")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /pendente\. Marcar como realizado/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(r);
    await userEvent.click(screen.getByText("Supermercado"));
    expect(onOpen).toHaveBeenCalledWith(r);
  });

  it("renders invoice payments read-only (no toggle)", () => {
    const r = release({ kind: "INVOICE_PAYMENT", card: { id: 3, name: "Itaú", active: true }, account: { id: 1, name: "Itaú", active: true }, invoiceMonthYear: "10/2026" });
    render(<ReleaseRow release={r} onOpen={() => {}} onToggleDone={() => {}} />);
    expect(screen.getByText("Pagamento de fatura Itaú")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como/ })).not.toBeInTheDocument();
  });
});

describe("TotalsStrip + hide values", () => {
  const totals = { revenues: { done: 1000, forecast: 2000 }, expenses: { done: 400, forecast: 900 }, balance: { done: 600, forecast: 1100 } };

  it("shows realized and forecast values", () => {
    render(<TotalsStrip totals={totals} filtered={false} />);
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
  });

  it("masks every value when values are hidden", () => {
    act(() => usePrefs.setState({ showValues: false }));
    render(<TotalsStrip totals={totals} filtered />);
    expect(screen.queryByText("R$ 1.000,00")).not.toBeInTheDocument();
    expect(screen.getAllByText("valor oculto").length).toBeGreaterThan(0);
    expect(screen.getByText(/filtrados/)).toBeInTheDocument();
  });
});

describe("fireEvent sanity", () => {
  it("keeps jsdom wired", () => {
    const fn = vi.fn();
    render(<button onClick={fn}>x</button>);
    fireEvent.click(screen.getByText("x"));
    return waitFor(() => expect(fn).toHaveBeenCalled());
  });
});
