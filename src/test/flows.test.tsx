import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNetworkLab } from "@/data/network-lab";
import { setSessionUserId, resetDB } from "@/data/server/db";
import { openReleaseForm } from "@/features/releases/release-form";
import { LoginView } from "@/features/auth/login-view";
import { useSession } from "@/features/session/store";
import { renderWithProviders } from "./utils";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

beforeEach(() => {
  useNetworkLab.setState({ latency: "instant", failureRate: 0, offline: false });
  resetDB();
  useSession.setState({ user: null, rememberedEmail: null });
  replace.mockReset();
});

describe("login flow (F2)", () => {
  it("validates fields and signs in with the demo account", async () => {
    renderWithProviders(<LoginView />);
    const submit = await screen.findByRole("button", { name: "Entrar" });
    await userEvent.click(submit);
    expect(await screen.findByText("Informe seu e-mail.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("E-mail"), "demo@finax.app");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(submit);
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /demonstração/ }));
    await userEvent.click(submit);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
    expect(useSession.getState().user?.firstName).toBe("Marina");
  });
});

describe("release form (§5.1)", () => {
  it("blocks saving without amount and category, then saves a valid expense", async () => {
    setSessionUserId(1);
    useSession.setState({ user: { id: 1, email: "demo@finax.app", firstName: "Marina", access: "PREMIUM", active: true, subscriptionPlan: "YEARLY", provider: "LOCAL" } });
    renderWithProviders(<div />);
    act(() => openReleaseForm({ mode: "new", type: "E" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova despesa" });
    const save = within(dialog).getByRole("button", { name: "Salvar" });

    await userEvent.click(save);
    expect(await within(dialog).findByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escolha a conta ou o cartão.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escolha uma categoria.")).toBeInTheDocument();
  });
});
