#!/usr/bin/env python3
"""Gera relatorios diarios a partir dos commits git (22/05/2026 a 25/06/2026)."""
import subprocess
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "docs" / "Reumos-Diarios"

# Resumos executivos por data (DD-MM-YYYY) — dias sem chave = template vazio
SUMMARIES: dict[str, dict] = {
    "23-05-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "24-05-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "25-05-2026": {
        "overview": "O dia foi dedicado a consolidar o fluxo de propostas ao candidato e conectá-lo à pré-admissão. Foram corrigidos envio, visualização pública, reenvio e aceite automático, além de pequenos ajustes no portal de admissão.",
        "themes": [
            ("Propostas ao candidato", "Evoluímos o ciclo completo da proposta: envio por e-mail, link público com tenant correto, edição e reenvio, confirmações mais claras e aceite automático pelo candidato."),
            ("Integração com pré-admissão", "Quando o candidato aceita a proposta, o processo passa a refletir o status de contratado e prepara a continuidade na admissão."),
            ("Experiência do analista", "Modais de aprovação e grid de documentos foram ampliados para leitura mais confortável. Propostas ficaram restritas ao responsável pela vaga."),
            ("Portal de admissão", "Sessões inválidas passam a ser limpas automaticamente, evitando travamentos para o candidato."),
        ],
        "gains": ["Candidato recebe e responde proposta com menos fricção.", "RH consegue reenviar e acompanhar propostas com mais controle.", "Aceite da proposta já encaminha para a admissão."],
        "attention": ["Validar em UAT o fluxo completo: proposta → aceite → pré-admissão.", "Confirmar que links públicos funcionam em todos os tenants."],
        "po": "Consolidamos o fluxo de propostas e sua ligação com a admissão. O candidato pode aceitar a oferta pelo link e o RH ganha reenvio, controle por responsável e telas mais legíveis.",
    },
    "26-05-2026": {
        "overview": "Início da frente de integração com o RM/TOTVS: dashboard de acompanhamento, fila de vagas e configuração visível no menu.",
        "themes": [
            ("Dashboard de integração RM", "Nova visão para acompanhar o status da integração com o sistema corporativo."),
            ("Operação de vagas", "Vagas novas passam a entrar corretamente na fila de integração."),
            ("Configuração", "Integração TOTVS aparece no menu e permite salvar parâmetros de forma confiável."),
        ],
        "gains": ["RH e TI passam a enxergar a integração RM de forma centralizada.", "Menos risco de vaga ficar fora da fila de sincronização."],
        "attention": ["Testar salvamento de configuração RM em ambiente HMG."],
        "po": "Começamos a integração RM com dashboard, fila de vagas e item de menu para configuração.",
    },
    "27-05-2026": {
        "overview": "Dia intenso em integração RM, aprovações e recrutamento: requisições do RM, entrevistas públicas e fluxo de aumento de quadro.",
        "themes": [
            ("Integração RM", "Permissões, endpoint de requisições e registro nos acessos do sistema."),
            ("Aprovações", "Tela mostra autor e urgência; ações restritas conforme perfil."),
            ("Recrutamento e entrevistas", "Confirmação pública de entrevista, notificação ao RH sobre respostas e ampliação de testes UAT."),
            ("Aumento de quadro", "Gestor aprova e o fluxo conclui corretamente após decisão."),
            ("Rastreabilidade", "Versão do front passa a refletir o commit publicado."),
        ],
        "gains": ["Requisições RM ficam acessíveis dentro do Portal.", "Entrevistas com confirmação pelo candidato.", "Aumento de quadro opera de ponta a ponta."],
        "attention": ["Validar UAT de recrutamento completo após mudanças.", "Conferir notificações de entrevista em produção."],
        "po": "Avançamos RM, aprovações e recrutamento: requisições integradas, entrevistas confirmáveis pelo candidato e aumento de quadro funcionando.",
    },
    "28-05-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "29-05-2026": {
        "overview": "Marco na integração com o RM: importação de requisições aprovadas como vagas, com flag para ocultar fluxo legado e vínculo de pré-admissão à vaga.",
        "themes": [
            ("Importação RM → Vagas", "Requisições aprovadas no RM podem virar vagas no Portal, manual ou com regras configuráveis."),
            ("Governança do fluxo", "Flag de origem RM permite desligar o fluxo legado de requisições quando a empresa usa só o RM."),
            ("Pré-admissão", "Processo de admissão passa a estar ligado à vaga da candidatura."),
            ("Qualidade", "UAT de recrutamento completo estabilizado e mensagens de erro mais claras ao carregar requisições."),
        ],
        "gains": ["Menos retrabalho ao abrir vagas já aprovadas no RM.", "Admissão contextualizada à vaga correta.", "Base pronta para operação RM-first."],
        "attention": ["Testar importação manual e automática em tenant piloto.", "Revisar vagas criadas antes da flag RM."],
        "po": "Passamos a importar requisições RM aprovadas como vagas, vincular pré-admissão à vaga e preparar operação sem fluxo legado duplicado.",
    },
    "30-05-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "31-05-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "01-06-2026": {
        "overview": "Refinamento da listagem e importação automática de requisições RM, com grid mais útil e logs de acompanhamento.",
        "themes": [
            ("Grid de requisições RM", "Colunas, status operacionais (incluindo suspensa e em andamento) e visual mais limpo."),
            ("Importação automática", "Configuração por tenant e registro de logs para auditoria."),
            ("Listagem de vagas", "Títulos longos truncados para melhor leitura."),
        ],
        "gains": ["RH enxerga requisições RM com status correto.", "Importação pode rodar sozinha com rastreio.", "Telas mais estáveis após correções de build."],
        "attention": ["Monitorar logs da importação automática nos primeiros dias.", "Validar mapa de status com equipe de negócio."],
        "po": "Melhoramos a tela de requisições RM, ligamos importação automática por tenant e adicionamos logs para acompanhar o processo.",
    },
    "02-06-2026": {
        "overview": "Ajustes nos detalhes exibidos nas requisições RM para alinhar informação ao que o RH espera ver.",
        "themes": [("Detalhes de requisições RM", "Correções pontuais na exibição de dados complementares das requisições importadas.")],
        "gains": ["Informação mais fiel ao RM na tela de detalhe."],
        "attention": ["Comparar campos com amostra real do RM."],
        "po": "Pequeno refinamento na visualização de detalhes das requisições RM.",
    },
    "03-06-2026": {
        "overview": "Grande dia de infraestrutura e RM: fluxo consolidado de vagas RM, deploy automático DEV/HMG, bootstrap de tenants, usuários e integrações.",
        "themes": [
            ("Fluxo RM de vagas", "Consolidação do caminho RM → vagas e melhorias no Hub de vagas."),
            ("Deploy e ambientes", "Pipeline DEV/HMG, tokens GHCR e fluxo via PR para homologação."),
            ("Bootstrap automático", "Tenants, usuários iniciais, integrações RM e extensões de banco provisionados no startup."),
            ("Serviço de IA", "Variáveis de ambiente respeitadas corretamente."),
        ],
        "gains": ["Ambientes sobem mais previsíveis.", "Novo tenant fica operacional com menos intervenção manual.", "RM e vagas caminham juntos."],
        "attention": ["Validar bootstrap em deploy limpo.", "Conferir seed de usuários no compose DEV."],
        "po": "Consolidamos vagas RM, automatizamos deploy DEV/HMG e provisionamento inicial de tenants, usuários e integrações.",
    },
    "04-06-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "05-06-2026": {
        "overview": "Estabilização de deploy produção, healthchecks e sincronização RM/talentos.",
        "themes": [
            ("Deploy PRD", "Configuração do fluxo de produção."),
            ("Confiabilidade", "Healthcheck IPv4, watermarks RM em UTC e menos concorrência na sync de talentos."),
            ("UX RM", "Indicador de carregamento nas requisições RM."),
        ],
        "gains": ["Deploy mais estável.", "Sync RM com menos falhas intermitentes.", "Usuário vê feedback ao carregar requisições."],
        "attention": ["Monitorar sync de talentos após ajuste de concorrência."],
        "po": "Preparamos produção, corrigimos healthchecks e melhoramos estabilidade da integração RM e feedback visual.",
    },
    "06-06-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "07-06-2026": {
        "overview": "Portal mais adaptável ao ambiente e importação RM com feedback ao usuário.",
        "themes": [
            ("Portal dinâmico", "Entrada e redirecionamentos respeitam ambiente e porta corretos."),
            ("Importação RM", "Mensagens de progresso e resultado mais claras ao importar."),
        ],
        "gains": ["Menos erro de URL em HMG/DEV.", "RH entende o que aconteceu na importação."],
        "attention": ["Testar redirect em HTTPS com porta não padrão."],
        "po": "Ajustamos entrada do portal por ambiente e demos feedback visual na importação RM.",
    },
    "08-06-2026": {
        "overview": "Dia focado em talentos, vagas públicas e importação RM: currículos, e-mails, timeline de aprovações e ocultação de salário no portal.",
        "themes": [
            ("Detalhe do talento", "Visualização de currículo, envio de e-mail, anexo de CV e layout refinado."),
            ("Importação RM", "Resolução de empresa, pareceres e timeline de aprovações alinhada ao RM."),
            ("Portal de vagas", "Salário oculto publicamente; dados básicos da vaga ajustados."),
            ("Privacidade", "Informações sensíveis de remuneração fora da API pública."),
        ],
        "gains": ["RH opera talentos sem sair do Portal.", "Candidato vê vagas sem exposição indevida de salário.", "Aprovações RM mais legíveis."],
        "attention": ["Validar preview de PDF em diferentes navegadores.", "Confirmar política de exibição de salário com RH."],
        "po": "Enriquecemos gestão de talentos com CV e e-mail, melhoramos importação RM e ocultamos salário no portal público.",
    },
    "09-06-2026": {
        "overview": "Lançamento e evolução do relatório de funcionários RM, com ficha visual, histórico salarial e exportação.",
        "themes": [
            ("Relatório de funcionários RM", "Listagem, movimentações, cálculos e exportação XLSX."),
            ("Ficha do funcionário", "Visualização completa, impressão em nova aba, filiação, cargos e coligada."),
            ("Relatório em tempo real", "Consulta live ao RM para dados atualizados."),
            ("Kanban/candidatos", "Pequenos ajustes de layout e edição."),
        ],
        "gains": ["RH consulta quadro RM dentro do Portal.", "Ficha pronta para análise e impressão.", "Histórico salarial e gestor visíveis."],
        "attention": ["Validar performance do relatório live com base grande.", "Conferir filiação e coligada em casos reais."],
        "po": "Entregamos relatório e ficha de funcionários RM, com histórico, exportação e consulta em tempo real.",
    },
    "10-06-2026": {
        "overview": "Refinamento da ficha RM, dashboards por perfil e visualização de PDFs no recrutamento.",
        "themes": [
            ("Ficha e lista RM", "Timeline, colunas, gestor direto, filiação e carregamento sob demanda."),
            ("Dashboard Analista de RH", "De mock para dados reais, filtrado por carteira do analista."),
            ("Documentos no recrutamento", "PDFs e CVs visíveis no modal de candidatos, hub de vagas e portal do candidato."),
            ("Vagas", "Checklist no topo do resumo; descrição DNALIO corrigida."),
        ],
        "gains": ["Analista vê indicadores da própria carteira.", "CV acessível sem download externo.", "Ficha RM mais legível e completa."],
        "attention": ["Validar dashboard com analistas reais.", "Testar preview de PDF no hub com vários formatos."],
        "po": "Refinamos ficha RM, conectamos dashboard da analista a dados reais e liberamos visualização de CV/PDF no recrutamento.",
    },
    "11-06-2026": {
        "overview": "Dashboards por perfil (gestor e especialista), importador DNALIO e centralização da configuração RM.",
        "themes": [
            ("Dashboards", "Gestor e Especialista de RH com visual alinhado ao da analista."),
            ("DNALIO", "Importador de descrições e validação na publicação de vagas."),
            ("Configuração RM", "Ponto único para parâmetros de integração."),
            ("Gestores RM", "Testes e provisionamento de usuários gestores vindos do RM."),
        ],
        "gains": ["Cada perfil enxerga indicadores relevantes.", "Publicação de vagas mais segura com DNALIO.", "Config RM menos dispersa."],
        "attention": ["Validar KPIs do gestor vs requisições ativas.", "Testar importador DNALIO em lote."],
        "po": "Entregamos dashboards do gestor e especialista, importador DNALIO e configuração RM centralizada.",
    },
    "12-06-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "13-06-2026": {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."},
    "14-06-2026": {
        "overview": "Melhorias de identidade do usuário e alinhamento de KPIs do dashboard do gestor.",
        "themes": [
            ("Topbar", "Chip de perfil do usuário logado."),
            ("Dashboard gestor", "KPIs alinhados ao critério de requisições ativas."),
        ],
        "gains": ["Usuário sabe qual perfil está usando.", "Números do gestor batem com a grid de requisições."],
        "attention": ["Confirmar chip em todos os perfis."],
        "po": "Adicionamos identificação de perfil na barra superior e alinhamos KPIs do gestor às requisições ativas.",
    },
    "15-06-2026": {
        "overview": "Preparação e correção do login Microsoft (Entra ID) em HMG, com HTTPS e configuração administrável.",
        "themes": [
            ("SSO Microsoft", "Tela Entra ID, callback, CORS e TLS na porta 5000."),
            ("Configuração", "Parâmetros Entra 100% no banco via admin, sem depender só de arquivo."),
            ("Ferramentas", "Scripts de importação com auto-login e troca de tenant."),
        ],
        "gains": ["Login corporativo Microsoft viável em HMG.", "TI configura SSO pelo admin.", "Menos bloqueio de CORS após TLS."],
        "attention": ["Validar fluxo completo Entra em HMG HTTPS.", "Novos usuários SSO podem precisar orientação."],
        "po": "Preparamos SSO Microsoft (Entra ID) em HMG com configuração pelo admin e correções de CORS/TLS.",
    },
    "16-06-2026": {
        "overview": "Login Microsoft simplificado, KPIs de solicitações e navegação mais clara.",
        "themes": [
            ("Login", "Botão oficial Entrar com Microsoft, tenant default e distinção login local vs SSO."),
            ("Dashboard analista", "KPI de solicitações de vaga alinhado à grid."),
            ("Navegação", "Menu lateral com todas as seções expandidas por padrão."),
        ],
        "gains": ["Login mais intuitivo para usuários corporativos.", "Indicadores consistentes entre dashboard e listagens.", "Menu mais fácil de explorar."],
        "attention": ["Testar login local e Microsoft no mesmo tenant.", "Validar KPI com solicitações reais."],
        "po": "Simplificamos login Microsoft, unificamos critério de solicitações ativas e melhoramos o menu lateral.",
    },
    "17-06-2026": {
        "overview": "Lançamento do Hub Corporativo Liotecnica: launcher de apps, SSO para o Portal RH e primeiras fases de controle de acessos (IAM).",
        "themes": [
            ("Hub Corporativo", "Interface redesenhada, grid de aplicativos, upload de ícones e SSO via token seguro."),
            ("Integração Portal RH", "Acesso ao Portal a partir do Hub sem novo login."),
            ("IAM Fases 1 e 2", "Controle de acessos, perfis, permissões e auditoria inicial."),
            ("HMG", "Correções de porta, bootstrap admin e Entra após redeploy."),
        ],
        "gains": ["Ponto único de entrada para sistemas da empresa.", "SSO fluido para o Portal RH.", "Base de governança de acessos no Hub."],
        "attention": ["Validar SSO Hub → Portal em HMG.", "Revisar perfis IAM antes de liberar amplamente."],
        "po": "Entregamos o Hub Corporativo com SSO para o Portal RH e iniciamos controle de acessos (IAM) com administração de perfis e permissões.",
    },
    "18-06-2026": {
        "overview": "Evolução do IAM do Hub: administração completa, auto-provisionamento no SSO e acesso direto a aplicativos.",
        "themes": [
            ("IAM Fase 3", "Admin de usuários, perfis, sistemas e auditoria."),
            ("SSO", "Usuário provisionado automaticamente no Hub ao entrar via SSO."),
            ("Simplificação", "Acesso direto a apps sem CRUD complexo de perfis onde não era necessário."),
        ],
        "gains": ["Administração centralizada de identidades.", "Primeiro acesso SSO cria usuário automaticamente."],
        "attention": ["Revisar permissões default de usuários auto-provisionados."],
        "po": "Completamos admin IAM no Hub e auto-provisionamento no SSO, simplificando acesso aos aplicativos.",
    },
    "19-06-2026": {
        "overview": "Login por senha e LDAP no Hub, melhorias em solicitações RM e performance da integração.",
        "themes": [
            ("Autenticação Hub", "Senha local, LDAP/AD configurável, gestão pelo admin e exclusão de usuários."),
            ("Solicitações", "Coluna e busca por código RM."),
            ("RM", "Título da vaga pela função RM, tipos de requisição restritos e correção de timeouts."),
            ("Vagas", "Remoção da aba Diversidade conforme simplificação do cadastro."),
        ],
        "gains": ["Hub aceita AD corporativo.", "Busca por código RM agiliza operação.", "Consultas RM mais rápidas e estáveis."],
        "attention": ["Testar LDAP em Linux (bind AD).", "Validar reset de importação RM em tenant piloto."],
        "po": "Hub ganhou login LDAP/senha, solicitações com código RM e integração RM mais rápida e estável.",
    },
    "20-06-2026": {
        "overview": "Performance RM via SQL direto, importação de desligamentos e simplificação das telas de gestão.",
        "themes": [
            ("Performance RM", "Consultas SQL quando CORPORERM configurado; timeouts alinhados."),
            ("Desligamentos RM", "Importação ativada por default no deploy."),
            ("Gestão", "Solicitações e Requisição de Pessoal simplificadas; tipografia alinhada ao Quadro de Vagas."),
            ("Kanban", "Colunas Reprovado RH/Gestor e renomeação de Contratado."),
            ("UI", "Padronização de listagens, candidatos e topbar."),
        ],
        "gains": ["Listagens RM respondem mais rápido.", "Desligamentos entram no radar do Portal.", "Telas de gestão mais limpas."],
        "attention": ["Monitorar consultas SQL RM em produção.", "Validar colunas novas do kanban com RH."],
        "po": "Aceleramos consultas RM, importamos desligamentos e simplificamos telas de gestão e kanban.",
    },
    "21-06-2026": {
        "overview": "Módulo de desligamentos, simplificação do portal de vagas e efetivação sem dependência do TOTVS.",
        "themes": [
            ("Desligamentos", "Entrevista de saída manual, efetivação no Portal sem TOTVS e manual para analistas."),
            ("Portal de vagas", "Remoção de agenda/disponibilidade do candidato."),
            ("Vagas", "Campo Cargo removido do formulário para simplificar cadastro."),
        ],
        "gains": ["RH conduz desligamento dentro do Portal.", "Documentação clara para analistas.", "Cadastro de vaga mais enxuto."],
        "attention": ["UAT do fluxo de desligamento ponta a ponta.", "Comunicar remoção de agenda aos usuários."],
        "po": "Avançamos desligamentos com entrevista de saída e efetivação no Portal, além de simplificar vagas e portal público.",
    },
    "22-06-2026": {
        "overview": "Ferramenta de deploy por SSH, admissão simplificada, ajustes de dashboard e documentação operacional.",
        "themes": [
            ("Deploy", "GUI SSH para DEV/HMG sem GitHub Actions; purge de imagens Docker."),
            ("Admissão", "Fluxo simplificado, visibilidade RH, cartas e tracking liberado por perfil."),
            ("Portal vagas", "Logo Liotécnica e proxy API no nginx HMG."),
            ("Documentação", "Manual candidatura → pré-admissão e registro SSO Hub."),
        ],
        "gains": ["Deploy mais controlado pela equipe.", "Admissão mais clara para RH e candidato.", "HMG mais estável para portal e API."],
        "attention": ["Treinar equipe na GUI de deploy.", "Validar tracking de admissão com perfis restritos."],
        "po": "Entregamos deploy GUI SSH, simplificamos admissão/pré-admissão e documentamos jornada candidato → admissão.",
    },
    "23-06-2026": {
        "overview": "Menu de desligamentos, kanban alinhado ao funil Key User e portal público de admissão com documentos completos.",
        "themes": [
            ("Desligamentos", "Menu dedicado abaixo de Solicitações com permissões no catálogo de acessos."),
            ("Kanban", "10 colunas do funil Key User, incluindo coluna Testes."),
            ("Portal de admissão", "Relação completa de documentos, PDF, lightbox e experiência pública."),
        ],
        "gains": ["Desligamentos visíveis no menu correto.", "Funil de recrutamento alinhado ao processo acordado.", "Candidato vê claramente quais documentos enviar."],
        "attention": ["Validar kanban com especialista Key User.", "UAT portal admissão com lista CLT completa."],
        "po": "Organizamos desligamentos no menu, alinhamos kanban ao funil de 10 colunas e evoluímos portal público de admissão.",
    },
    "24-06-2026": {
        "overview": "Evolução intensa do portal de admissão: tracking, validação por etapa, upload com miniatura e validação por IA.",
        "themes": [
            ("Tracking admissão", "Acesso por perfil, query param para export estático e ações conforme status."),
            ("Upload de documentos", "Cards com miniatura, preview, validação IA em modal e documentos CLT padrão."),
            ("Owner/tenant", "Link de exemplo para portal público no menu do tenant."),
        ],
        "gains": ["RH acompanha admissão pelo tracking.", "Candidato envia docs com feedback visual imediato.", "IA alerta documentos suspeitos sem bloquear indevidamente."],
        "attention": ["Validar falsos positivos da IA com RH.", "Testar retomada de sessão pelo candidato."],
        "po": "Portal de admissão ganhou tracking, upload moderno com miniatura e validação por etapa com apoio de IA.",
    },
    "25-06-2026": {
        "overview": "Wizard de admissão com uma etapa por documento, splash de boas-vindas e sidebar clicável para navegação.",
        "themes": [
            ("Wizard por documento", "Cada um dos 9 documentos em etapa separada, sem scroll na tela."),
            ("Boas-vindas", "Splash explicando envio de documentos e preenchimento de dados."),
            ("Navegação", "Rodapé fixo Voltar/Continuar; sidebar permite voltar a etapas concluídas."),
            ("Refinamentos", "Miniaturas compactas nos cards de documento."),
        ],
        "gains": ["Candidato não se perde em lista longa de uploads.", "Experiência guiada passo a passo.", "RH mantém controle; candidato retoma de onde parou."],
        "attention": ["UAT mobile do wizard sem scroll.", "Confirmar migração de progresso salvo de versão anterior."],
        "po": "Transformamos upload de documentos em wizard passo a passo, com boas-vindas, rodapé fixo e sidebar navegável.",
    },
}


def render(day_key: str, d: date) -> str:
    dd = d.strftime("%d/%m/%Y")
    s = SUMMARIES.get(day_key)
    if not s:
        s = {"overview": "Não houve entregas registradas no repositório nesta data.", "themes": [], "gains": [], "attention": [], "po": "Dia sem movimentação de desenvolvimento documentada."}

    lines = [f"# Relatório de Atividades - {dd}", "", "## Visão geral do dia", "", s["overview"], ""]

    if s["themes"]:
        lines += ["## Principais frentes trabalhadas", ""]
        for title, body in s["themes"]:
            lines += [f"### {title}", "", body, ""]

    if s["gains"]:
        lines += ["## Ganhos para o usuário/RH", ""]
        for g in s["gains"]:
            lines.append(f"- {g}")
        lines.append("")

    if s["attention"]:
        lines += ["## Pontos de atenção", ""]
        for a in s["attention"]:
            lines.append(f"- {a}")
        lines.append("")

    lines += ["## Resumo para conversa com o PO", "", s["po"], ""]
    return "\n".join(lines)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    start = date(2026, 5, 22)
    end = date(2026, 6, 25)
    d = start
    created = 0
    skipped = 0
    while d <= end:
        key = d.strftime("%d-%m-%Y")
        path = OUT / f"relatorio-atividades-{key}.md"
        if path.name == "relatorio-atividades-22-05-2026.md" and path.exists() and path.stat().st_size > 500:
            skipped += 1
        else:
            path.write_text(render(key, d), encoding="utf-8")
            created += 1
        d += timedelta(days=1)
    print(f"Created/updated: {created}, skipped existing 22-05: {skipped}")


if __name__ == "__main__":
    main()
