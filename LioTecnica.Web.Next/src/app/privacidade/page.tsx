import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
    title: "Política de Privacidade — Voltage RenderRH",
    description:
        "Política de privacidade e proteção de dados pessoais do Voltage RenderRH em conformidade com a LGPD (Lei 13.709/2018).",
};

/**
 * Política de Privacidade pública.
 *
 * Migrada de `LioTecnica.Web/Views/Home/Privacy.cshtml` (Fase 13.1 — Sessão 25).
 * A view original era um placeholder; este texto cobre o mínimo LGPD real.
 */
export default function PrivacidadePage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800">
            <Link
                href="/login"
                className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar ao login
            </Link>

            <header className="mb-10">
                <h1 className="mb-2 text-4xl font-semibold tracking-tight text-slate-900">
                    Política de Privacidade
                </h1>
                <p className="text-sm text-slate-500">
                    Última atualização: 20 de abril de 2026
                </p>
            </header>

            <section className="space-y-8 text-[15px] leading-relaxed">
                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">1. Quem somos</h2>
                    <p>
                        O <strong>Voltage RenderRH</strong> é uma plataforma de gestão de recursos
                        humanos e recrutamento operada pela LioTécnica. Esta política descreve como
                        tratamos dados pessoais em conformidade com a Lei Geral de Proteção de Dados
                        (LGPD — Lei 13.709/2018).
                    </p>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        2. Dados que coletamos
                    </h2>
                    <ul className="list-disc space-y-1 pl-6">
                        <li>
                            <strong>Dados de candidatos e colaboradores</strong>: nome, e-mail, CPF,
                            telefone, endereço, histórico profissional, formação, currículos e anexos.
                        </li>
                        <li>
                            <strong>Dados de uso</strong>: registros de login, endereço IP, horário
                            de acesso e trilhas de auditoria de ações relevantes (criar vaga, aprovar
                            contratação, etc.).
                        </li>
                        <li>
                            <strong>Dados de integração</strong>: quando o cliente ativa SSO
                            Microsoft (Entra ID), recebemos os claims mínimos (e-mail, nome,
                            identificador único) apenas para autenticação.
                        </li>
                    </ul>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        3. Finalidade do tratamento
                    </h2>
                    <p>Os dados pessoais são tratados para:</p>
                    <ul className="list-disc space-y-1 pl-6">
                        <li>Gestão de processos seletivos, contratação, folha e desligamento.</li>
                        <li>Comunicação com candidatos e colaboradores sobre etapas de processos.</li>
                        <li>Cumprimento de obrigações legais e contratuais.</li>
                        <li>Segurança, auditoria e prevenção a fraudes.</li>
                    </ul>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        4. Compartilhamento
                    </h2>
                    <p>
                        Dados pessoais <strong>não são vendidos</strong> nem compartilhados para fins
                        de marketing. Podemos compartilhar com:
                    </p>
                    <ul className="list-disc space-y-1 pl-6">
                        <li>Provedores de infraestrutura (armazenamento, e-mail, WhatsApp).</li>
                        <li>Sistemas integrados autorizados pelo cliente (TOTVS, folha).</li>
                        <li>Autoridades, quando exigido por lei ou ordem judicial.</li>
                    </ul>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        5. Seus direitos (LGPD art. 18)
                    </h2>
                    <p>Você pode, a qualquer momento, solicitar:</p>
                    <ul className="list-disc space-y-1 pl-6">
                        <li>Confirmação da existência de tratamento.</li>
                        <li>Acesso aos dados.</li>
                        <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                        <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
                        <li>Portabilidade dos dados a outro fornecedor.</li>
                        <li>Revogação de consentimento.</li>
                    </ul>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        6. Retenção
                    </h2>
                    <p>
                        Os dados são retidos pelo período necessário ao cumprimento das finalidades
                        para as quais foram coletados ou exigidos por lei, após o que são
                        anonimizados ou excluídos.
                    </p>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        7. Segurança
                    </h2>
                    <p>
                        Adotamos medidas técnicas e administrativas aptas a proteger os dados
                        pessoais contra acessos não autorizados, destruição, perda, alteração,
                        comunicação ou qualquer forma de tratamento indevido. O acesso é segregado
                        por perfil e todas as ações sensíveis são auditadas.
                    </p>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        8. Encarregado (DPO)
                    </h2>
                    <p>
                        Em caso de dúvidas, solicitações ou reclamações, entre em contato com o
                        encarregado de dados da sua organização (administrador do tenant) ou com o
                        suporte LioTécnica pelos canais oficiais contratados.
                    </p>
                </div>

                <div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-900">
                        9. Atualizações desta política
                    </h2>
                    <p>
                        Esta política pode ser atualizada periodicamente. Alterações relevantes são
                        comunicadas via sistema. A versão em vigor sempre fica disponível nesta
                        página.
                    </p>
                </div>
            </section>
        </main>
    );
}
