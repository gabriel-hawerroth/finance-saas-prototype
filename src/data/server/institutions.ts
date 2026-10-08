import type { Institution } from "@/domain/types";

/**
 * Global institution catalogue. Logos are drawn as coloured monograms
 * (no third-party brand assets are bundled).
 */
export const INSTITUTIONS: Institution[] = [
  { id: 1, name: "Carteira", code: null, category: "WALLET", color: "#6b7a5a", mark: "$" },
  { id: 2, name: "Nubank", code: "260", category: "BANK", color: "#820ad1", mark: "Nu" },
  { id: 3, name: "Itaú", code: "341", category: "BANK", color: "#ec7000", mark: "It" },
  { id: 4, name: "Bradesco", code: "237", category: "BANK", color: "#cc092f", mark: "Br" },
  { id: 5, name: "Banco do Brasil", code: "001", category: "BANK", color: "#f5c400", mark: "BB" },
  { id: 6, name: "Caixa Econômica Federal", code: "104", category: "BANK", color: "#005ca9", mark: "Cx" },
  { id: 7, name: "Santander", code: "033", category: "BANK", color: "#ea1d25", mark: "Sa" },
  { id: 8, name: "Inter", code: "077", category: "BANK", color: "#ff7a00", mark: "In" },
  { id: 9, name: "C6 Bank", code: "336", category: "BANK", color: "#242424", mark: "C6" },
  { id: 10, name: "BTG Pactual", code: "208", category: "BANK", color: "#0b2341", mark: "BT" },
  { id: 11, name: "Sicredi", code: "748", category: "BANK", color: "#3fa110", mark: "Si" },
  { id: 12, name: "Sicoob", code: "756", category: "BANK", color: "#003641", mark: "Sc" },
  { id: 13, name: "PicPay", code: "380", category: "BANK", color: "#11c76f", mark: "Pp" },
  { id: 14, name: "Mercado Pago", code: "323", category: "BANK", color: "#00b1ea", mark: "MP" },
  { id: 15, name: "PagBank", code: "290", category: "BANK", color: "#1bb99a", mark: "Pg" },
  { id: 16, name: "Banrisul", code: "041", category: "BANK", color: "#004b8d", mark: "Bs" },
  { id: 17, name: "Safra", code: "422", category: "BANK", color: "#1c2b4a", mark: "Sf" },
  { id: 18, name: "Neon", code: "735", category: "BANK", color: "#00a5e0", mark: "Ne" },
  { id: 19, name: "XP Investimentos", code: "102", category: "BROKERAGE", color: "#1a1a1a", mark: "XP" },
  { id: 20, name: "Rico", code: "102", category: "BROKERAGE", color: "#ff5a00", mark: "Ri" },
  { id: 21, name: "NuInvest", code: null, category: "BROKERAGE", color: "#5a0a9e", mark: "NI" },
  { id: 22, name: "Ágora", code: null, category: "BROKERAGE", color: "#0b6f7c", mark: "Ág" },
  { id: 23, name: "Tesouro Direto", code: null, category: "BROKERAGE", color: "#2d6a3e", mark: "TD" },
  { id: 24, name: "Alelo", code: null, category: "BENEFIT", color: "#007a3d", mark: "Al" },
  { id: 25, name: "Pluxee", code: null, category: "BENEFIT", color: "#2a1b6e", mark: "Px" },
  { id: 26, name: "VR Benefícios", code: null, category: "BENEFIT", color: "#00953b", mark: "VR" },
  { id: 27, name: "Ticket", code: null, category: "BENEFIT", color: "#e4002b", mark: "Tk" },
  { id: 28, name: "Flash", code: null, category: "BENEFIT", color: "#fe2b8f", mark: "Fl" },
  { id: 29, name: "Caju", code: null, category: "BENEFIT", color: "#f25c05", mark: "Cj" },
];

export const WALLET_ID = 1;
