import Link from "next/link";
import { StaticPage } from "./static-page";

function Legal({ title, updated, sections, other }: { title: string; updated: string; sections: [string, string][]; other: { href: string; label: string } }) {
  return (
    <StaticPage>
      <article className="grid gap-8">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Atualizado em {updated}</p>
          <h1 className="mt-2 font-display text-5xl leading-none">{title}</h1>
        </header>
        {sections.map(([h, p], i) => (
          <section key={h} aria-labelledby={`s${i}`}>
            <h2 id={`s${i}`} className="text-lg font-semibold">
              {i + 1}. {h}
            </h2>
            <p className="mt-2 leading-relaxed text-ink-2">{p}</p>
          </section>
        ))}
        <p className="leading-relaxed text-ink-2">
          Dúvidas? Escreva para{" "}
          <a href="mailto:suporte@appfinax.com.br" className="font-medium text-ink underline underline-offset-4">
            suporte@appfinax.com.br
          </a>
          . Veja também: <Link href={other.href} className="font-medium text-ink underline underline-offset-4">{other.label}</Link>.
        </p>
        <Link href="/" className="inline-flex h-11 w-fit items-center rounded-[var(--radius-md)] bg-primary px-5 text-sm font-medium text-primary-fg">
          Voltar ao início
        </Link>
      </article>
    </StaticPage>
  );
}

export function PrivacyPolicy() {
  return (
    <Legal
      title="Política de privacidade"
      updated="08/10/2026"
      other={{ href: "/termos-de-uso", label: "Termos de uso" }}
      sections={[
        ["Quais dados coletamos", "Coletamos os dados que você informa para usar o Finax: nome, e-mail, foto de perfil opcional e os registros financeiros que você cadastra (contas, cartões, categorias, lançamentos e anexos)."],
        ["Como usamos", "Usamos seus dados exclusivamente para prestar o serviço: calcular saldos, faturas e relatórios, e enviar e-mails transacionais como ativação, recuperação de senha e confirmação de cancelamento."],
        ["Compartilhamento", "Não vendemos seus dados. Compartilhamos apenas com provedores essenciais à operação (hospedagem e envio de e-mails), sob contrato e com o mínimo necessário."],
        ["Seus direitos", "Você pode acessar, corrigir e excluir seus dados a qualquer momento. A exclusão da conta é definitiva e confirmada por um link enviado ao seu e-mail."],
        ["Segurança", "Aplicamos boas práticas de segurança, como sessões protegidas e transmissão criptografada. Nunca pedimos as senhas dos seus bancos."],
      ]}
    />
  );
}

export function TermsOfUse() {
  return (
    <Legal
      title="Termos de uso"
      updated="08/10/2026"
      other={{ href: "/politica-de-privacidade", label: "Política de privacidade" }}
      sections={[
        ["Aceitação", "Ao criar uma conta você concorda com estes termos. Se não concordar, não utilize o serviço."],
        ["O serviço", "O Finax é uma ferramenta de organização financeira pessoal. As informações exibidas dependem dos dados que você registra e não constituem aconselhamento financeiro."],
        ["Sua conta", "Você é responsável por manter suas credenciais em sigilo e pelas atividades realizadas na sua conta."],
        ["Planos", "Durante o acesso antecipado, todos os recursos estão disponíveis. Quem se cadastra nesse período mantém o plano Básico gratuito."],
        ["Encerramento", "Você pode cancelar sua conta quando quiser pelo seu perfil. Podemos suspender contas que violem estes termos."],
      ]}
    />
  );
}
