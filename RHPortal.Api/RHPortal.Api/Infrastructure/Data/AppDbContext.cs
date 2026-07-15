using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Auditing.Entities;
using RhPortal.Api.Logging.Entities;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data;

public sealed class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid, IdentityUserClaim<Guid>, ApplicationUserRole, IdentityUserLogin<Guid>, IdentityRoleClaim<Guid>, IdentityUserToken<Guid>>
{
    private readonly ITenantContext _tenantContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<AuditTransaction> AuditTransactions => Set<AuditTransaction>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<AuditEntityChange> AuditEntityChanges => Set<AuditEntityChange>();
    public DbSet<AuditEntityPropertyChange> AuditEntityPropertyChanges => Set<AuditEntityPropertyChange>();
    public DbSet<RequestLog> RequestLogs => Set<RequestLog>();
    public DbSet<LogEntry> LogEntries => Set<LogEntry>();
    public DbSet<ExceptionLog> ExceptionLogs => Set<ExceptionLog>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<RoleMenu> RoleMenus => Set<RoleMenu>();

    // Area e Department foram consolidados em CentroCusto na Sessão 31.2.
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<UserUnit> UserUnits => Set<UserUnit>();
    public DbSet<JobPosition> JobPositions => Set<JobPosition>();
    public DbSet<Pessoa> Pessoas => Set<Pessoa>();
    public DbSet<PessoaBloqueio> PessoaBloqueios => Set<PessoaBloqueio>();
    public DbSet<Talento> Talentos => Set<Talento>();
    public DbSet<TalentoCompetencia> TalentoCompetencias => Set<TalentoCompetencia>();
    public DbSet<TalentoExperiencia> TalentoExperiencias => Set<TalentoExperiencia>();
    public DbSet<TalentoTreinamento> TalentoTreinamentos => Set<TalentoTreinamento>();
    public DbSet<TalentoFormacao> TalentoFormacoes => Set<TalentoFormacao>();
    public DbSet<TalentoDocumento> TalentoDocumentos => Set<TalentoDocumento>();
    public DbSet<TalentoCvImportJob> TalentoCvImportJobs => Set<TalentoCvImportJob>();
    public DbSet<Funcionario> Funcionarios => Set<Funcionario>();
    public DbSet<SolicitacaoVaga> SolicitacoesVaga => Set<SolicitacaoVaga>();
    public DbSet<RmRequisicaoParecer> RmRequisicaoPareceres => Set<RmRequisicaoParecer>();
    public DbSet<SolicitacaoVagaIntegracaoTentativa> SolicitacoesVagaIntegracaoTentativas => Set<SolicitacaoVagaIntegracaoTentativa>();
    public DbSet<SolicitacaoVagaIndicacao> SolicitacoesVagaIndicacao => Set<SolicitacaoVagaIndicacao>();
    public DbSet<RmRequisicaoStatusMap> RmRequisicaoStatusMaps => Set<RmRequisicaoStatusMap>();
    public DbSet<SolicitacaoDesligamento> SolicitacoesDesligamento => Set<SolicitacaoDesligamento>();
    public DbSet<SolicitacaoPromocao> SolicitacoesPromocao => Set<SolicitacaoPromocao>();
    public DbSet<SolicitacaoFerias> SolicitacoesFerias => Set<SolicitacaoFerias>();
    public DbSet<SolicitacaoBeneficio> SolicitacoesBeneficio => Set<SolicitacaoBeneficio>();
    public DbSet<SolicitacaoDependente> SolicitacoesDependente => Set<SolicitacaoDependente>();
    public DbSet<SolicitacaoEndereco> SolicitacoesEndereco => Set<SolicitacaoEndereco>();
    public DbSet<SolicitacaoPagamentoExtra> SolicitacoesPagamentoExtra => Set<SolicitacaoPagamentoExtra>();
    public DbSet<Dependente> Dependentes => Set<Dependente>();
    public DbSet<DocumentoColaborador> DocumentosColaborador => Set<DocumentoColaborador>();
    public DbSet<PreAdmissao> PreAdmissoes => Set<PreAdmissao>();
    public DbSet<PreAdmissaoDocumento> PreAdmissaoDocumentos => Set<PreAdmissaoDocumento>();
    public DbSet<PreAdmissaoDocumentoSolicitado> PreAdmissaoDocumentosSolicitados => Set<PreAdmissaoDocumentoSolicitado>();
    public DbSet<PreAdmissaoDependente> PreAdmissaoDependentes => Set<PreAdmissaoDependente>();
    public DbSet<FaixaSalarial> FaixasSalariais => Set<FaixaSalarial>();
    public DbSet<NivelHierarquico> NiveisHierarquicos => Set<NivelHierarquico>();
    public DbSet<ProjetoVaga> ProjetosVaga => Set<ProjetoVaga>();
    public DbSet<ProjetoCandidato> ProjetoCandidatos => Set<ProjetoCandidato>();
    public DbSet<FaseProcesso> FasesProcesso => Set<FaseProcesso>();
    public DbSet<CampoPersonalizadoVaga> CamposPersonalizadosVaga => Set<CampoPersonalizadoVaga>();
    public DbSet<RespostaCampoPersonalizadoVaga> RespostasCampoPersonalizadoVaga => Set<RespostaCampoPersonalizadoVaga>();
    public DbSet<LogComunicacao> LogsComunicacao => Set<LogComunicacao>();
    public DbSet<AprovacaoFaixaSalarial> AprovacoesFaixaSalarial => Set<AprovacaoFaixaSalarial>();
    public DbSet<PermissaoNivelVaga> PermissoesNivelVaga => Set<PermissaoNivelVaga>();
    public DbSet<Vaga> Vagas => Set<Vaga>();
    public DbSet<OcupacaoHistorico> OcupacoesHistorico => Set<OcupacaoHistorico>();
    public DbSet<VagaBeneficio> VagaBeneficios => Set<VagaBeneficio>();
    public DbSet<VagaRequisito> VagaRequisitos => Set<VagaRequisito>();
    public DbSet<VagaEtapa> VagaEtapas => Set<VagaEtapa>();
    public DbSet<VagaPergunta> VagaPerguntas => Set<VagaPergunta>();
    public DbSet<Candidato> Candidatos => Set<Candidato>();
    public DbSet<CandidatoDocumento> CandidatoDocumentos => Set<CandidatoDocumento>();
    public DbSet<CandidatoCompetencia> CandidatoCompetencias => Set<CandidatoCompetencia>();
    public DbSet<CandidatoCertificacao> CandidatoCertificacoes => Set<CandidatoCertificacao>();
    public DbSet<CandidatoPortfolio> CandidatoPortfolios => Set<CandidatoPortfolio>();
    public DbSet<CandidatoEducacaoResumo> CandidatoEducacaoResumos => Set<CandidatoEducacaoResumo>();
    public DbSet<CandidatoEducacaoItem> CandidatoEducacaoItens => Set<CandidatoEducacaoItem>();
    public DbSet<CandidatoExperiencia> CandidatoExperiencias => Set<CandidatoExperiencia>();
    public DbSet<CandidatoProjeto> CandidatoProjetos => Set<CandidatoProjeto>();
    public DbSet<CandidatoPreferenciasVaga> CandidatoPreferenciasVaga => Set<CandidatoPreferenciasVaga>();
    public DbSet<CandidatoReferencia> CandidatoReferencias => Set<CandidatoReferencia>();
    public DbSet<CandidatoAcessibilidade> CandidatoAcessibilidades => Set<CandidatoAcessibilidade>();
    public DbSet<CandidatoAgendaPreferencia> CandidatoAgendaPreferencias => Set<CandidatoAgendaPreferencia>();
    public DbSet<CandidatoAgendaBloqueio> CandidatoAgendaBloqueios => Set<CandidatoAgendaBloqueio>();
    public DbSet<CandidatoNotificacaoPreferencia> CandidatoNotificacaoPreferencias => Set<CandidatoNotificacaoPreferencia>();
    public DbSet<CandidatoPortalNotificacao> CandidatoPortalNotificacoes => Set<CandidatoPortalNotificacao>();
    public DbSet<CandidatoLgpdConsent> CandidatoLgpdConsents => Set<CandidatoLgpdConsent>();
    public DbSet<CandidatoStatusHistory> CandidatoStatusHistories => Set<CandidatoStatusHistory>();
    public DbSet<EmailConfig> EmailConfigs => Set<EmailConfig>();
    public DbSet<EntraIdConfig> EntraIdConfigs => Set<EntraIdConfig>();
    public DbSet<LocalizationConfig> LocalizationConfigs => Set<LocalizationConfig>();
    public DbSet<EmailMessage> EmailMessages => Set<EmailMessage>();
    public DbSet<EmailMessageAttachment> EmailMessageAttachments => Set<EmailMessageAttachment>();
    public DbSet<EmailAttempt> EmailAttempts => Set<EmailAttempt>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<InboxItem> InboxItems => Set<InboxItem>();
    public DbSet<InboxAnexo> InboxAttachments => Set<InboxAnexo>();
    public DbSet<AgendaEventType> AgendaEventTypes => Set<AgendaEventType>();
    public DbSet<AgendaEvent> AgendaEvents => Set<AgendaEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationReceipt> NotificationReceipts => Set<NotificationReceipt>();
    public DbSet<CelebrationPost> CelebrationPosts => Set<CelebrationPost>();
    public DbSet<CelebrationMention> CelebrationMentions => Set<CelebrationMention>();
    public DbSet<CelebrationComment> CelebrationComments => Set<CelebrationComment>();
    public DbSet<CelebrationCommentMention> CelebrationCommentMentions => Set<CelebrationCommentMention>();
    public DbSet<CelebrationCommentReaction> CelebrationCommentReactions => Set<CelebrationCommentReaction>();
    public DbSet<FeedbackItem> FeedbackItems => Set<FeedbackItem>();
    public DbSet<FeedbackItemRating> FeedbackItemRatings => Set<FeedbackItemRating>();
    public DbSet<DevelopmentPlan> DevelopmentPlans => Set<DevelopmentPlan>();
    public DbSet<DevelopmentPlanGoal> DevelopmentPlanGoals => Set<DevelopmentPlanGoal>();
    public DbSet<NineBoxAssessment> NineBoxAssessments => Set<NineBoxAssessment>();
    public DbSet<Meta> Metas => Set<Meta>();
    public DbSet<AvaliacaoCiclo> AvaliacaoCiclos => Set<AvaliacaoCiclo>();
    public DbSet<AvaliacaoPergunta> AvaliacaoPerguntas => Set<AvaliacaoPergunta>();
    public DbSet<AvaliacaoResposta> AvaliacaoRespostas => Set<AvaliacaoResposta>();
    public DbSet<AvaliacaoConvite> AvaliacaoConvites => Set<AvaliacaoConvite>();
    public DbSet<AvaliacaoCalibragem> AvaliacaoCalibragens => Set<AvaliacaoCalibragem>();
    public DbSet<AvaliacaoTemplate> AvaliacaoTemplates => Set<AvaliacaoTemplate>();
    public DbSet<AvaliacaoTemplatePergunta> AvaliacaoTemplatePerguntas => Set<AvaliacaoTemplatePergunta>();
    public DbSet<OneOnOneMeeting> OneOnOneMeetings => Set<OneOnOneMeeting>();
    public DbSet<OneOnOneTemplate> OneOnOneTemplates => Set<OneOnOneTemplate>();
    public DbSet<OneOnOneTemplateItem> OneOnOneTemplateItens => Set<OneOnOneTemplateItem>();
    public DbSet<FeedbackTemplate> FeedbackTemplates => Set<FeedbackTemplate>();
    public DbSet<SurveyTemplate> SurveyTemplates => Set<SurveyTemplate>();
    public DbSet<SurveyTemplateQuestion> SurveyTemplateQuestions => Set<SurveyTemplateQuestion>();
    public DbSet<MetaCheckin> MetaCheckins => Set<MetaCheckin>();
    public DbSet<RenderCoinReward> RenderCoinRewards => Set<RenderCoinReward>();
    public DbSet<RenderCoinRedemption> RenderCoinRedemptions => Set<RenderCoinRedemption>();
    public DbSet<MoodEntry> MoodEntries => Set<MoodEntry>();
    public DbSet<RenderCoinBalance> RenderCoinBalances => Set<RenderCoinBalance>();
    public DbSet<RenderCoinTransaction> RenderCoinTransactions => Set<RenderCoinTransaction>();
    public DbSet<GamificationDailyState> GamificationDailyStates => Set<GamificationDailyState>();
    public DbSet<Survey> Surveys => Set<Survey>();
    public DbSet<SurveyQuestion> SurveyQuestions => Set<SurveyQuestion>();
    public DbSet<SurveyOption> SurveyOptions => Set<SurveyOption>();
    public DbSet<SurveyResponse> SurveyResponses => Set<SurveyResponse>();
    public DbSet<SurveyAnswer> SurveyAnswers => Set<SurveyAnswer>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<TenantAwsSettings> TenantAwsSettings => Set<TenantAwsSettings>();
    public DbSet<TenantConfiguracao> TenantConfiguracoes => Set<TenantConfiguracao>();
    public DbSet<TenantRmConfiguracao> TenantRmConfiguracoes => Set<TenantRmConfiguracao>();
    public DbSet<TenantBranding> TenantBrandings => Set<TenantBranding>();
    public DbSet<CandidatoVagaMatchingScore> CandidatoVagaMatchingScores => Set<CandidatoVagaMatchingScore>();
    public DbSet<VagaUnifiedMatchingCache> VagaUnifiedMatchingCaches => Set<VagaUnifiedMatchingCache>();
    public DbSet<Cargo> Cargos => Set<Cargo>();
    public DbSet<NivelCargo> NiveisCargo => Set<NivelCargo>();
    public DbSet<DescricaoCargo> DescricoesCargo => Set<DescricaoCargo>();
    public DbSet<DescricaoCargoItem> DescricaoCargoItens => Set<DescricaoCargoItem>();
    public DbSet<DescricaoCargoItemEmbedding> DescricaoCargoItemEmbeddings => Set<DescricaoCargoItemEmbedding>();
    public DbSet<CandidatoEmbedding> CandidatoEmbeddings => Set<CandidatoEmbedding>();
    public DbSet<CandidatoVagaLlmScore> CandidatoVagaLlmScores => Set<CandidatoVagaLlmScore>();
    public DbSet<EixoVaga> EixosVaga => Set<EixoVaga>();
    public DbSet<PropostaVaga> PropostasVaga => Set<PropostaVaga>();
    public DbSet<Candidatura> Candidaturas => Set<Candidatura>();
    public DbSet<CandidaturaEtapaHistorico> CandidaturaEtapaHistoricos => Set<CandidaturaEtapaHistorico>();
    public DbSet<NotificacaoCandidaturaLog> NotificacoesCandidaturaLogs => Set<NotificacaoCandidaturaLog>();
    public DbSet<NotificacaoTemplate> NotificacoesTemplates => Set<NotificacaoTemplate>();
    public DbSet<CategoriaSalarial> CategoriasSalariais => Set<CategoriaSalarial>();
    public DbSet<CategoriaSalarialStep> CategoriaSalarialSteps => Set<CategoriaSalarialStep>();
    public DbSet<Turno> Turnos => Set<Turno>();
    public DbSet<CentroCusto> CentrosCusto => Set<CentroCusto>();
    public DbSet<UnidadeLotacao> UnidadesLotacao => Set<UnidadeLotacao>();
    public DbSet<MotivoRequisicaoVagaConfig> MotivosRequisicaoVagaConfig => Set<MotivoRequisicaoVagaConfig>();
    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Hierarquia> Hierarquias => Set<Hierarquia>();
    public DbSet<Desligamento> Desligamentos => Set<Desligamento>();
    public DbSet<FuncionarioMovimentacao> FuncionarioMovimentacoes => Set<FuncionarioMovimentacao>();
    public DbSet<RmSyncRun> RmSyncRuns => Set<RmSyncRun>();
    public DbSet<RmSyncCheckpoint> RmSyncCheckpoints => Set<RmSyncCheckpoint>();
    public DbSet<RmSyncAlerta> RmSyncAlertas => Set<RmSyncAlerta>();
    public DbSet<RmWorkerCycleSettings> RmWorkerCycleSettings => Set<RmWorkerCycleSettings>();
    public DbSet<RmImportacaoAutomaticaRun> RmImportacaoAutomaticaRuns => Set<RmImportacaoAutomaticaRun>();
    public DbSet<EtapaConfigAprovacao> EtapasConfigAprovacao => Set<EtapaConfigAprovacao>();
    public DbSet<FluxoAprovacaoConfig> FluxosAprovacaoConfig => Set<FluxoAprovacaoConfig>();
    public DbSet<SolicitacaoAprovacaoEtapa> SolicitacoesAprovacaoEtapa => Set<SolicitacaoAprovacaoEtapa>();
    public DbSet<ApprovalMagicLink> ApprovalMagicLinks => Set<ApprovalMagicLink>();
    public DbSet<TemplateEntrevistaSaida> TemplatesEntrevistaSaida => Set<TemplateEntrevistaSaida>();
    public DbSet<PerguntaEntrevistaSaida> PerguntasEntrevistaSaida => Set<PerguntaEntrevistaSaida>();
    public DbSet<EntrevistaSaida> EntrevistasSaida => Set<EntrevistaSaida>();
    public DbSet<RespostaEntrevistaSaida> RespostasEntrevistaSaida => Set<RespostaEntrevistaSaida>();
    public DbSet<AprovadorAlternativo> AprovadoresAlternativos => Set<AprovadorAlternativo>();
    public DbSet<DocumentacaoPadraoConfig> DocumentacaoPadraoConfigs => Set<DocumentacaoPadraoConfig>();
    public DbSet<DocumentacaoPadraoPorNivelCargoConfig> DocumentacaoPadraoPorNivelCargoConfigs => Set<DocumentacaoPadraoPorNivelCargoConfig>();
    public DbSet<DocumentacaoPadraoPorCargoConfig> DocumentacaoPadraoPorCargoConfigs => Set<DocumentacaoPadraoPorCargoConfig>();
    public DbSet<DocumentacaoPadraoHistorico> DocumentacaoPadraoHistoricos => Set<DocumentacaoPadraoHistorico>();
    public DbSet<WorkflowRH> WorkflowsRH => Set<WorkflowRH>();
    public DbSet<EtapaWorkflowRH> EtapasWorkflowRH => Set<EtapaWorkflowRH>();
    public DbSet<EtapaConfigWorkflowRH> EtapasConfigWorkflowRH => Set<EtapaConfigWorkflowRH>();
    public DbSet<HistoricoAlteracaoWorkflowRH> HistoricosAlteracaoWorkflowRH => Set<HistoricoAlteracaoWorkflowRH>();
    public DbSet<DadosBancarios> DadosBancarios => Set<DadosBancarios>();
    public DbSet<Holerite> Holerites => Set<Holerite>();
    public DbSet<HistoricoStatus> HistoricosStatus => Set<HistoricoStatus>();
    public DbSet<SlaStatusConfig> SlaStatusConfigs => Set<SlaStatusConfig>();
    public DbSet<SlaEtapaCandidaturaConfig> SlaEtapaCandidaturaConfigs => Set<SlaEtapaCandidaturaConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>(b =>
        {
            b.ToTable("Users");

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.NormalizedUserName)
                .HasDatabaseName("UserNameIndex")
                .IsUnique(false);

            b.HasIndex(x => x.NormalizedEmail)
                .HasDatabaseName("EmailIndex")
                .IsUnique(false);

            b.HasIndex(x => new { x.TenantId, x.NormalizedUserName }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.NormalizedEmail }).IsUnique(false);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ApplicationRole>(b =>
        {
            b.ToTable("Roles");

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Description).HasMaxLength(400);
            b.Property(x => x.IsActive).IsRequired();
            b.Property(x => x.VisibilityScope).HasDefaultValue(RHPortal.Api.Domain.Enums.ProfileVisibilityScope.FullStructure);
            b.Property(x => x.VagasDataScope).HasDefaultValue(RHPortal.Api.Domain.Enums.VagasDataScope.All);
            b.Property(x => x.AccessMode).HasDefaultValue(RHPortal.Api.Domain.Enums.ProfileAccessMode.Full);
            b.Property(x => x.Tipo).HasDefaultValue(RHPortal.Api.Domain.Enums.RoleTipo.Colaborador);

            b.HasIndex(x => x.NormalizedName)
                .HasDatabaseName("RoleNameIndex")
                .IsUnique(false);

            b.HasIndex(x => new { x.TenantId, x.NormalizedName }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ApplicationUserRole>(b =>
        {
            b.ToTable("UserRoles");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasIndex(x => new { x.TenantId, x.RoleId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Menu>(b =>
        {
            b.ToTable("Menus");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.DisplayName).HasMaxLength(160).IsRequired();
            b.Property(x => x.DisplayNameKey).HasMaxLength(200);
            b.Property(x => x.Route).HasMaxLength(240).IsRequired();
            b.Property(x => x.Icon).HasMaxLength(120);
            b.Property(x => x.PermissionKey).HasMaxLength(160).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.PermissionKey }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.Route });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RoleMenu>(b =>
        {
            b.ToTable("RoleMenus");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.PermissionKey).HasMaxLength(160).IsRequired();

            b.HasOne(x => x.Role)
                .WithMany()
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Menu)
                .WithMany()
                .HasForeignKey(x => x.MenuId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.RoleId, x.MenuId, x.PermissionKey }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // Area foi consolidada em CentroCusto na Sessão 31.2 (ver Domain/Entities/CentroCusto.cs).

        // RequisitoCategoria ("Função") removida — conceito redundante com JobPosition
        // (Cargo). Migration 20260423_RemoveRequisitoCategoria dropa FKs + tabela.

        // Department foi consolidado em CentroCusto na Sessão 31.2 (ver Domain/Entities/CentroCusto.cs).

        modelBuilder.Entity<Unit>(b =>
        {
            b.ToTable("Units");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(140).IsRequired();

            b.Property(x => x.City).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);

            b.Property(x => x.AddressLine).HasMaxLength(220);
            b.Property(x => x.Neighborhood).HasMaxLength(120);
            b.Property(x => x.ZipCode).HasMaxLength(12);

            b.Property(x => x.Email).HasMaxLength(180);
            b.Property(x => x.Phone).HasMaxLength(40);

            b.Property(x => x.ResponsibleName).HasMaxLength(140);
            b.Property(x => x.Type).HasMaxLength(120);

            b.Property(x => x.Notes).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.EmpresaId, x.Code })
             .IsUnique()
             .HasFilter("\"EmpresaId\" IS NOT NULL");
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);

            b.HasOne(x => x.Empresa)
             .WithMany()
             .HasForeignKey(x => x.EmpresaId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Empresa>(b =>
        {
            b.ToTable("Empresas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Hierarquia>(b =>
        {
            b.ToTable("Hierarquias");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(200).IsRequired();
            b.Property(x => x.Estrutura).HasMaxLength(200);
            b.HasIndex(x => new { x.TenantId, x.IdHierarquiaRm }).IsUnique();
            b.HasIndex(x => x.IdHierarquiaSuperiorRm);
            b.HasIndex(x => x.Estrutura);
            b.HasOne(x => x.HierarquiaSuperior)
                .WithMany()
                .HasForeignKey(x => x.HierarquiaSuperiorId)
                .OnDelete(DeleteBehavior.Restrict);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<FuncionarioMovimentacao>(b =>
        {
            b.ToTable("FuncionarioMovimentacoes");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ChapaRm).HasMaxLength(20).IsRequired();
            b.Property(x => x.IdReqRm).HasMaxLength(40).IsRequired();
            b.Property(x => x.TipoDescricao).HasMaxLength(60);
            b.Property(x => x.StatusDescricao).HasMaxLength(60);
            b.Property(x => x.CodFuncaoOrigem).HasMaxLength(20);
            b.Property(x => x.FuncaoOrigemNome).HasMaxLength(160);
            b.Property(x => x.CodSecaoOrigem).HasMaxLength(60);
            b.Property(x => x.CodSecaoDestino).HasMaxLength(60);
            b.Property(x => x.CodFuncaoDestino).HasMaxLength(20);
            b.Property(x => x.FuncaoDestinoNome).HasMaxLength(160);
            b.Property(x => x.GestorHistoricoChapaRm).HasMaxLength(20);
            b.Property(x => x.GestorHistoricoNome).HasMaxLength(160);
            b.Property(x => x.SalarioOrigem).HasPrecision(18, 2);
            b.Property(x => x.SalarioDestino).HasPrecision(18, 2);
            b.HasIndex(x => new { x.TenantId, x.IdReqRm }).IsUnique();
            b.HasIndex(x => x.ChapaRm);
            b.HasIndex(x => x.TipoMovimentacao);
            b.HasIndex(x => x.FuncionarioId);
            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Desligamento>(b =>
        {
            b.ToTable("Desligamentos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.IdReqRm).HasMaxLength(40).IsRequired();
            b.Property(x => x.ChapaRm).HasMaxLength(20).IsRequired();
            b.Property(x => x.CodMotivoRescisao).HasMaxLength(10);
            b.Property(x => x.MotivoRescisaoDescricao).HasMaxLength(120);
            b.Property(x => x.TipoRescisaoDescricao).HasMaxLength(120);
            b.HasIndex(x => new { x.TenantId, x.IdReqRm }).IsUnique();
            b.HasIndex(x => x.ChapaRm);
            b.HasIndex(x => x.CodStatus);
            b.HasIndex(x => x.GerouSubstituicao);
            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmSyncRun>(b =>
        {
            b.ToTable("RmSyncRuns");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Entidade).HasMaxLength(60).IsRequired();
            b.Property(x => x.Operacao).HasMaxLength(20).IsRequired();
            b.Property(x => x.ErroMensagem).HasMaxLength(2000);
            b.HasIndex(x => new { x.TenantId, x.Entidade, x.StartedAtUtc })
                .HasDatabaseName("IX_RmSyncRuns_TenantId_Entidade_StartedAtUtc")
                .IsDescending(false, false, true);
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmSyncCheckpoint>(b =>
        {
            b.ToTable("RmSyncCheckpoints");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Entidade).HasMaxLength(60).IsRequired();
            b.Property(x => x.LastRunStatus).HasMaxLength(20);
            b.Property(x => x.Notes).HasMaxLength(500);
            b.HasIndex(x => new { x.TenantId, x.Entidade }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmSyncAlerta>(b =>
        {
            b.ToTable("RmSyncAlertas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40).IsRequired();
            b.Property(x => x.EntidadeNome).HasMaxLength(40).IsRequired();
            b.Property(x => x.ChaveRm).HasMaxLength(80).IsRequired();
            b.Property(x => x.Acao).HasMaxLength(120);
            b.HasIndex(x => new { x.TenantId, x.Tipo, x.ChaveRm }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.ResolvidoEmUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmWorkerCycleSettings>(b =>
        {
            b.ToTable("RmWorkerCycleSettings");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => x.TenantId).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmImportacaoAutomaticaRun>(b =>
        {
            b.ToTable("RmImportacaoAutomaticaRuns");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasMaxLength(30).IsRequired();
            b.Property(x => x.Mensagem).HasMaxLength(1000);
            b.Property(x => x.LogText).HasColumnType("text");
            b.HasIndex(x => new { x.TenantId, x.StartedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmRequisicaoParecer>(b =>
        {
            b.ToTable("RmRequisicaoPareceres");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TipoRequisicao).HasMaxLength(60).IsRequired();
            b.Property(x => x.Solicitante).HasMaxLength(200);
            b.Property(x => x.ChapaSolicitante).HasMaxLength(30);
            b.Property(x => x.Parecer).HasMaxLength(4000);
            b.Property(x => x.Status).HasMaxLength(120);
            b.HasIndex(x => new { x.TenantId, x.TipoRequisicao, x.CodColRequisicao, x.IdReq, x.IdParecer }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.SolicitacaoVagaId, x.DataParecer });
            b.HasOne(x => x.SolicitacaoVaga)
                .WithMany()
                .HasForeignKey(x => x.SolicitacaoVagaId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<UserUnit>(b =>
        {
            b.ToTable("UserUnits");
            b.HasKey(x => new { x.UserId, x.UnitId });

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Unit)
                .WithMany()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.UnitId);
        });

        modelBuilder.Entity<JobPosition > (b =>
        {
            b.ToTable("JobPositions");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(160).IsRequired();

            b.Property(x => x.Type).HasMaxLength(180);
            b.Property(x => x.Description).HasMaxLength(1000);
            b.Property(x => x.SimilarityIndicator).HasMaxLength(1);
            b.Property(x => x.FullDescription).HasMaxLength(500);

            b.Property(x => x.CentroCustoId).IsRequired(false);

            b.HasOne(x => x.CentroCusto)
                .WithMany()
                .HasForeignKey(x => x.CentroCustoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.CentroCustoId);
            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();

            b.HasIndex(x => new { x.TenantId, x.TotvsCargoBasicId, x.TotvsNivCargoId })
                .IsUnique()
                .HasFilter("\"TotvsCargoBasicId\" IS NOT NULL AND \"TotvsNivCargoId\" IS NOT NULL");

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Cargo>(b =>
        {
            b.ToTable("Cargos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.Property(x => x.OccupationalClassification).HasMaxLength(30);
            b.Property(x => x.CargoType).HasMaxLength(30);
            b.Property(x => x.SimilarityIndicator).HasMaxLength(1);
            b.Property(x => x.FullDescription).HasMaxLength(500);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasIndex(x => x.IsActive);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CategoriaSalarial>(b =>
        {
            b.ToTable("CategoriasSalariais");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(10).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.Property(x => x.ValorBase).HasColumnType("decimal(18,2)");

            b.HasIndex(x => new { x.TenantId, x.EmpresaId, x.EstabelecimentoId, x.Code })
             .IsUnique()
             .HasFilter("\"EmpresaId\" IS NOT NULL AND \"EstabelecimentoId\" IS NOT NULL");
            b.HasIndex(x => x.IsActive);
            b.HasOne(x => x.Empresa).WithMany().HasForeignKey(x => x.EmpresaId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.Estabelecimento).WithMany().HasForeignKey(x => x.EstabelecimentoId).OnDelete(DeleteBehavior.SetNull);
            b.HasMany(x => x.Steps)
                .WithOne(x => x.CategoriaSalarial!)
                .HasForeignKey(x => x.CategoriaSalarialId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CategoriaSalarialStep>(b =>
        {
            b.ToTable("CategoriaSalarialSteps");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Percentual).HasColumnType("decimal(8,2)");
            b.Property(x => x.ValorOverride).HasColumnType("decimal(18,2)");
            b.Property(x => x.Observacao).HasMaxLength(200);

            b.HasIndex(x => new { x.TenantId, x.CategoriaSalarialId });
            b.HasIndex(x => new { x.TenantId, x.CategoriaSalarialId, x.Percentual }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Turno>(b =>
        {
            b.ToTable("Turnos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.Property(x => x.StartTime).HasMaxLength(5);
            b.Property(x => x.EndTime).HasMaxLength(5);
            b.Property(x => x.Notes).HasMaxLength(500);
            b.Property(x => x.GradeHorarioJson).HasColumnType("text");

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasIndex(x => x.IsActive);
            b.HasIndex(x => x.UnidadeLotacaoId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);

            b.HasOne(x => x.UnidadeLotacao)
             .WithMany()
             .HasForeignKey(x => x.UnidadeLotacaoId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CentroCusto>(b =>
        {
            b.ToTable("CentrosCusto");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.Property(x => x.Manager).HasMaxLength(120);
            b.Property(x => x.Notes).HasMaxLength(500);
            b.Property(x => x.Description2).HasMaxLength(1000);
            b.Property(x => x.Phone).HasMaxLength(40);
            b.Property(x => x.BranchOrLocation).HasMaxLength(160);

            b.HasIndex(x => new { x.TenantId, x.EmpresaId, x.Code })
             .IsUnique()
             .HasFilter("\"EmpresaId\" IS NOT NULL");
            b.HasIndex(x => x.IsActive);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);

            b.HasOne(x => x.Empresa)
             .WithMany()
             .HasForeignKey(x => x.EmpresaId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.ParentId);
            b.HasOne(x => x.Parent)
             .WithMany(x => x.Children)
             .HasForeignKey(x => x.ParentId)
             .OnDelete(DeleteBehavior.Restrict);

            // Dono organizacional (absorvido de Area.OwnerFuncionarioId — Sessão 31.2).
            b.HasIndex(x => x.OwnerFuncionarioId);
            b.HasOne(x => x.OwnerFuncionario)
             .WithMany()
             .HasForeignKey(x => x.OwnerFuncionarioId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<DescricaoCargo>(b =>
        {
            b.ToTable("DescricoesCargo");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Title).HasMaxLength(200).IsRequired();
            b.Property(x => x.Summary).HasMaxLength(2000);
            // Sessão 31.8 — campos do template DNALIO
            b.Property(x => x.AreaTemplate).HasMaxLength(120);
            b.Property(x => x.CboCodigo).HasMaxLength(20);
            b.Property(x => x.FormacaoMinima).HasMaxLength(200);
            b.Property(x => x.FormacaoDesejavel).HasMaxLength(200);
            b.Property(x => x.FormacaoAreaEstudo).HasMaxLength(200);
            b.Property(x => x.ExperienciaTempoMinimo).HasMaxLength(80);
            b.Property(x => x.ExperienciaTempoDesejavel).HasMaxLength(80);
            b.Property(x => x.ExperienciaEspecificacao).HasMaxLength(500);
            b.Property(x => x.RevisaoNumero).HasMaxLength(10);
            b.Property(x => x.RevisaoNatureza).HasMaxLength(200);
            b.Property(x => x.GestorNome).HasMaxLength(200);
            b.Property(x => x.GestorEmail).HasMaxLength(200);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasIndex(x => x.NivelCargoId);
            b.HasIndex(x => x.IsActive);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);

            b.HasOne(x => x.NivelCargo)
             .WithMany()
             .HasForeignKey(x => x.NivelCargoId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Itens)
             .WithOne(x => x.DescricaoCargo!)
             .HasForeignKey(x => x.DescricaoCargoId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DescricaoCargoItem>(b =>
        {
            b.ToTable("DescricaoCargoItens");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
            b.Property(x => x.NivelMinimo).HasMaxLength(40);
            b.Property(x => x.Subcategoria).HasMaxLength(80);
            b.Property(x => x.Categoria).HasConversion<short>();

            b.HasIndex(x => new { x.TenantId, x.DescricaoCargoId });
            b.HasIndex(x => new { x.TenantId, x.DescricaoCargoId, x.Categoria });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // ── Embeddings (pgvector) ───────────────────────────────────────────
        // Vetor armazenado como float[] no .NET e mapeado para vector(N) no Postgres
        // via Npgsql Vector type (conversão feita pelo driver com EnableDynamicJson).
        // OBS: a coluna "Embedding" é criada como texto na migration e convertida
        // manualmente via raw SQL em "AddEmbeddingVectorType" — vide migration.
        modelBuilder.Entity<DescricaoCargoItemEmbedding>(b =>
        {
            b.ToTable("DescricaoCargoItemEmbeddings");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ModelVersion).HasMaxLength(60).IsRequired();
            b.Property(x => x.TextoSource).HasMaxLength(4000);
            b.Property(x => x.Embedding).HasColumnType("vector(1024)");

            b.HasOne(x => x.DescricaoCargoItem)
                .WithMany()
                .HasForeignKey(x => x.DescricaoCargoItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.DescricaoCargoItemId }).IsUnique();
            b.HasIndex(x => x.TenantId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoEmbedding>(b =>
        {
            b.ToTable("CandidatoEmbeddings");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ModelVersion).HasMaxLength(60).IsRequired();
            b.Property(x => x.ConteudoHash).HasMaxLength(64).IsRequired();
            b.Property(x => x.TextoSource).HasMaxLength(8000);
            b.Property(x => x.Embedding).HasColumnType("vector(1024)");

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasIndex(x => x.TenantId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoVagaLlmScore>(b =>
        {
            b.ToTable("CandidatoVagaLlmScores");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ModelVersion).HasMaxLength(60).IsRequired();
            b.Property(x => x.InputHash).HasMaxLength(64).IsRequired();
            b.Property(x => x.JustificativaTexto).HasMaxLength(4000);
            b.Property(x => x.CriteriosJson).HasColumnType("jsonb");
            b.Property(x => x.PontosFortes).HasMaxLength(2000);
            b.Property(x => x.Gaps).HasMaxLength(2000);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.VagaId, x.CandidatoId }).IsUnique();
            b.HasIndex(x => x.TenantId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EixoVaga>(b =>
        {
            b.ToTable("EixosVaga");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.Description).HasMaxLength(400);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasIndex(x => x.IsActive);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<PropostaVaga>(b =>
        {
            b.ToTable("PropostasVaga");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasConversion<short>();
            b.Property(x => x.Moeda).HasMaxLength(3);
            b.Property(x => x.SalarioOferecido).HasPrecision(18, 2);
            b.Property(x => x.AccessToken).HasMaxLength(64);
            b.Property(x => x.NomeConfirmadoCandidato).HasMaxLength(160);
            b.Property(x => x.IpOrigemResposta).HasMaxLength(60);
            b.Property(x => x.UserAgentResposta).HasMaxLength(400);
            b.Property(x => x.MotivoRecusa).HasMaxLength(2000);
            b.Property(x => x.ObservacaoInternaRh).HasMaxLength(500);
            b.Property(x => x.DescricaoBeneficios).HasMaxLength(2000);
            b.Property(x => x.MensagemPersonalizada).HasMaxLength(8000);

            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasIndex(x => new { x.TenantId, x.CandidaturaId });
            b.HasIndex(x => x.AccessToken).IsUnique();

            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Candidatura).WithMany().HasForeignKey(x => x.CandidaturaId).OnDelete(DeleteBehavior.SetNull);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Candidatura>(b =>
        {
            b.ToTable("Candidaturas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasConversion<short>();
            b.Property(x => x.EtapaMacro).HasConversion<short>();
            b.Property(x => x.Fonte).HasMaxLength(60);
            b.Property(x => x.Observacoes).HasMaxLength(2000);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId, x.VagaId }).IsUnique();

            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.Restrict);

            b.HasMany(x => x.Historico)
                .WithOne(x => x.Candidatura!)
                .HasForeignKey(x => x.CandidaturaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidaturaEtapaHistorico>(b =>
        {
            b.ToTable("CandidaturaEtapaHistoricos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EtapaAnterior).HasConversion<short>();
            b.Property(x => x.EtapaNova).HasConversion<short>();
            b.Property(x => x.Observacao).HasMaxLength(2000);

            b.HasIndex(x => new { x.TenantId, x.CandidaturaId });

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<NotificacaoCandidaturaLog>(b =>
        {
            b.ToTable("NotificacoesCandidaturaLogs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EtapaMacro).HasConversion<short>();
            b.Property(x => x.Canal).HasConversion<short>();
            b.Property(x => x.Status).HasConversion<short>();
            b.Property(x => x.Destino).HasMaxLength(200);
            b.Property(x => x.Mensagem).HasMaxLength(4000);
            b.Property(x => x.ErroMensagem).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.CandidaturaId });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId });

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<NotificacaoTemplate>(b =>
        {
            b.ToTable("NotificacoesTemplates");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Etapa).HasConversion<short>();
            b.Property(x => x.Canal).HasConversion<short>();
            b.Property(x => x.Idioma).HasMaxLength(10);
            b.Property(x => x.Assunto).HasMaxLength(240);
            b.Property(x => x.Corpo).HasMaxLength(4000).IsRequired();

            // Unicidade por (TenantId, Etapa, Canal, Idioma) — Idioma null = template default por canal.
            b.HasIndex(x => new { x.TenantId, x.Etapa, x.Canal, x.Idioma }).IsUnique();

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<UnidadeLotacao>(b =>
        {
            b.ToTable("UnidadesLotacao");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CdnPlanoLotac).HasMaxLength(10).IsRequired();
            b.Property(x => x.Code).HasMaxLength(30).IsRequired();
            b.Property(x => x.Description).HasMaxLength(120).IsRequired();
            b.Property(x => x.Location).HasMaxLength(120);
            b.Property(x => x.Notes).HasMaxLength(500);
            b.Property(x => x.Level).HasDefaultValue(1);

            // Hierarquia pai-filho
            b.HasOne(x => x.Parent)
                .WithMany(x => x.Children)
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Responsável da unidade
            b.HasOne(x => x.OwnerFuncionario)
                .WithMany()
                .HasForeignKey(x => x.OwnerFuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.CdnPlanoLotac, x.Code }).IsUnique();
            b.HasIndex(x => x.IsActive);
            b.HasIndex(x => x.ParentId);
            b.HasIndex(x => x.OwnerFuncionarioId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<MotivoRequisicaoVagaConfig>(b =>
        {
            b.ToTable("MotivosRequisicaoVagaConfig");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(60).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(500);

            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Pessoa>(b =>
        {
            b.ToTable("Pessoas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Origem).HasConversion<int>();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Email).HasMaxLength(180).IsRequired();
            b.Property(x => x.Fone).HasMaxLength(40);
            b.Property(x => x.Cidade).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);
            b.Property(x => x.LinkedinUrl).HasMaxLength(260);
            b.Property(x => x.ResumoProfissional).HasMaxLength(2000);
            b.Property(x => x.Obs).HasMaxLength(2000);
            // Documentos LUC-122
            b.Property(x => x.Sexo).HasMaxLength(1);
            b.Property(x => x.EstadoCivil).HasMaxLength(2);
            b.Property(x => x.Naturalidade).HasMaxLength(120);
            b.Property(x => x.EstadoNatal).HasMaxLength(2);
            b.Property(x => x.GrauInstrucao).HasMaxLength(5);
            b.Property(x => x.RgOrgEmissor).HasMaxLength(20);
            b.Property(x => x.RgUf).HasMaxLength(2);
            b.Property(x => x.CarteiraTrabalho).HasMaxLength(20);
            b.Property(x => x.CarteiraTrabalhoSerie).HasMaxLength(10);
            b.Property(x => x.CarteiraTrabalhoUf).HasMaxLength(2);
            b.Property(x => x.NumeroPis).HasMaxLength(20);
            b.Property(x => x.TituloEleitor).HasMaxLength(20);
            b.Property(x => x.TituloEleitorZona).HasMaxLength(10);
            b.Property(x => x.TituloEleitorSecao).HasMaxLength(10);
            b.Property(x => x.CertificadoReservista).HasMaxLength(20);
            b.Property(x => x.CategoriaMilitar).HasMaxLength(2);

            b.HasIndex(x => new { x.TenantId, x.Email });
            b.HasIndex(x => new { x.TenantId, x.Cpf });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Talento>(b =>
        {
            b.ToTable("Talentos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CvProfileJson);
            b.Property(x => x.Versao);

            b.HasOne(x => x.Pessoa)
                .WithMany()
                .HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.PessoaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoCompetencia>(b =>
        {
            b.ToTable("TalentoCompetencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            b.Property(x => x.Nivel).HasMaxLength(40).IsRequired();
            b.Property(x => x.Evidencia).HasMaxLength(300);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Competencias)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoExperiencia>(b =>
        {
            b.ToTable("TalentoExperiencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Empresa).HasMaxLength(160).IsRequired();
            b.Property(x => x.Cargo).HasMaxLength(160).IsRequired();
            b.Property(x => x.Inicio).HasMaxLength(20);
            b.Property(x => x.Fim).HasMaxLength(20);
            b.Property(x => x.TipoContratacao).HasMaxLength(40);
            b.Property(x => x.Local).HasMaxLength(160);
            b.Property(x => x.Atividades).HasMaxLength(2400);
            b.Property(x => x.ResumoAtividades).HasMaxLength(800);
            b.Property(x => x.NivelSenioridade).HasMaxLength(40);
            b.Property(x => x.NivelHierarquico).HasMaxLength(80);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Experiencias)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoTreinamento>(b =>
        {
            b.ToTable("TalentoTreinamentos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Instituicao).HasMaxLength(160);
            b.Property(x => x.Ano).HasMaxLength(10);
            b.Property(x => x.Link).HasMaxLength(260);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Treinamentos)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoFormacao>(b =>
        {
            b.ToTable("TalentoFormacoes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Curso).HasMaxLength(160).IsRequired();
            b.Property(x => x.Instituicao).HasMaxLength(160);
            b.Property(x => x.Tipo).HasMaxLength(40);
            b.Property(x => x.Status).HasMaxLength(40);
            b.Property(x => x.Inicio).HasMaxLength(20);
            b.Property(x => x.Fim).HasMaxLength(20);
            b.Property(x => x.Observacoes).HasMaxLength(800);
            b.Property(x => x.Link).HasMaxLength(260);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Formacao)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoDocumento>(b =>
        {
            b.ToTable("TalentoDocumentos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeArquivo).HasMaxLength(200).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(120);
            b.Property(x => x.Descricao).HasMaxLength(240);
            b.Property(x => x.StorageFileName).HasMaxLength(260);
            b.Property(x => x.DataReferencia).HasMaxLength(20);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Documentos)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TalentoCvImportJob>(b =>
        {
            b.ToTable("TalentoCvImportJobs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.SuggestedDataJson);
            b.Property(x => x.ErrorMessage).HasMaxLength(2000);

            b.HasOne(x => x.Talento)
                .WithMany()
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.TalentoDocumento)
                .WithMany()
                .HasForeignKey(x => x.TalentoDocumentoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.TalentoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<PessoaBloqueio>(b =>
        {
            b.ToTable("PessoaBloqueios");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Motivo).HasMaxLength(500);
            b.Property(x => x.CreatedByUserId).HasMaxLength(120);

            b.HasOne(x => x.Pessoa)
                .WithMany(x => x.Bloqueios)
                .HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.PessoaId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Funcionario>(b =>
        {
            b.ToTable("Funcionarios");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(160).IsRequired();
            b.Property(x => x.Email).HasMaxLength(180);
            b.Property(x => x.Phone).HasMaxLength(40);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.Property(x => x.Headcount);
            b.Property(x => x.MatriculaRm).HasMaxLength(20);
            b.HasIndex(x => new { x.TenantId, x.MatriculaRm });
            b.Property(x => x.CodSituacaoRm).HasMaxLength(5);
            b.Property(x => x.SituacaoRmDescricao).HasMaxLength(60);
            b.HasIndex(x => new { x.TenantId, x.CodSituacaoRm });

            b.HasOne(x => x.Hierarquia)
                .WithMany()
                .HasForeignKey(x => x.HierarquiaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Pessoa)
                .WithMany()
                .HasForeignKey(x => x.PessoaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Unit)
                .WithMany()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.Restrict);

            // Pareamento EXPLÍCITO com CentroCusto.Funcionarios (coleção) para que
            // o EF Core não interprete esta referência como inverso de
            // CentroCusto.OwnerFuncionario (o que gera um índice UNIQUE errado
            // em OwnerFuncionarioId). Ver comentário em CentroCusto.Funcionarios.
            b.HasOne(x => x.CentroCusto)
                .WithMany(cc => cc.Funcionarios!)
                .HasForeignKey(x => x.CentroCustoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.JobPosition)
                .WithMany()
                .HasForeignKey(x => x.JobPositionId)
                .OnDelete(DeleteBehavior.Restrict);


            // Sprint 2: Hierarquia
            b.HasOne(x => x.NivelHierarquico)
                .WithMany()
                .HasForeignKey(x => x.NivelHierarquicoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.GestorDireto)
                .WithMany()
                .HasForeignKey(x => x.GestorDiretoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.UnidadeLotacao)
                .WithMany()
                .HasForeignKey(x => x.UnidadeLotacaoId)
                .OnDelete(DeleteBehavior.SetNull);

            // Chaves de integração TOTVS Datasul
            b.Property(x => x.CdnFuncionario).HasMaxLength(12);
            b.Property(x => x.CdnEmpresa).HasMaxLength(3);
            b.Property(x => x.CdnEstab).HasMaxLength(5);

            b.HasIndex(x => new { x.TenantId, x.Email })
                .HasFilter("\"Email\" IS NOT NULL");
            b.HasIndex(x => new { x.TenantId, x.CdnEmpresa, x.CdnEstab, x.CdnFuncionario })
                .IsUnique()
                .HasFilter("\"CdnFuncionario\" IS NOT NULL");
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SolicitacaoVaga>(b =>
        {
            b.ToTable("SolicitacoesVaga");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Titulo).HasMaxLength(160).IsRequired();
            b.Property(x => x.CodFuncaoRm).HasMaxLength(20);
            b.Property(x => x.FuncaoNomeRm).HasMaxLength(160);
            b.Property(x => x.Justificativa).HasMaxLength(2000);
            b.Property(x => x.ObservacaoAprovador).HasMaxLength(2000);
            b.Property(x => x.QtdPosicoes);

            b.HasOne(x => x.Solicitante)
                .WithMany()
                .HasForeignKey(x => x.SolicitanteId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Aprovador)
                .WithMany()
                .HasForeignKey(x => x.AprovadorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.AnalistaRhResponsavelUser)
                .WithMany()
                .HasForeignKey(x => x.AnalistaRhResponsavelUserId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.JobPosition)
                .WithMany()
                .HasForeignKey(x => x.JobPositionId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Unit)
                .WithMany()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.Restrict);

            // Sprint 1: Substituído
            b.HasOne(x => x.SubstituidoFuncionario)
                .WithMany()
                .HasForeignKey(x => x.SubstituidoFuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);
            b.Property(x => x.SubstituidoNome).HasMaxLength(160);

            // Motivo parametrizável (substitui o enum MotivoRequisicao)
            b.HasOne(x => x.Motivo)
                .WithMany()
                .HasForeignKey(x => x.MotivoRequisicaoId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Turno)
                .WithMany()
                .HasForeignKey(x => x.TurnoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.SolicitanteId });
            b.HasIndex(x => new { x.TenantId, x.AnalistaRhResponsavelUserId });
            b.HasIndex(x => new { x.TenantId, x.TipoSolicitacao, x.RmCriacaoSolicitadaEmUtc });
            b.HasIndex(x => x.MotivoRequisicaoId);
            b.Property(x => x.RmRequisicaoCodigo).HasMaxLength(120);
            b.Property(x => x.RmStatusSyncUltimaMensagem).HasMaxLength(2000);
            b.Property(x => x.RmUltimaStatusDescricaoRm).HasMaxLength(240);
            b.Property(x => x.FaixaSalarialMin).HasPrecision(18, 2);
            b.Property(x => x.FaixaSalarialMax).HasPrecision(18, 2);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SolicitacaoDesligamento>(b =>
        {
            b.Property(x => x.RmRequisicaoCodigo).HasMaxLength(120);
            b.Property(x => x.RmUltimaStatusDescricaoRm).HasMaxLength(240);
            b.HasIndex(x => new { x.TenantId, x.RmRequisicaoCodigo })
                .HasFilter("\"RmRequisicaoCodigo\" IS NOT NULL");
        });

        modelBuilder.Entity<SolicitacaoVagaIntegracaoTentativa>(b =>
        {
            b.ToTable("SolicitacaoVagaIntegracaoTentativas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TentativaEmUtc).IsRequired();
            b.Property(x => x.Sucesso).IsRequired();
            b.Property(x => x.PayloadResumo).HasMaxLength(8000);
            b.Property(x => x.MensagemErro).HasMaxLength(2000);
            b.Property(x => x.CodigoRmRetornado).HasMaxLength(120);

            b.HasOne(x => x.SolicitacaoVaga)
                .WithMany()
                .HasForeignKey(x => x.SolicitacaoVagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.SolicitacaoVagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SolicitacaoVagaIndicacao>(b =>
        {
            b.ToTable("SolicitacaoVagaIndicacoes");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Observacao).HasMaxLength(2000);
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.SolicitacaoVaga)
                .WithMany()
                .HasForeignKey(x => x.SolicitacaoVagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.SolicitacaoVagaId });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RmRequisicaoStatusMap>(b =>
        {
            b.ToTable("RmRequisicaoStatusMaps");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.PortalStatusKey).HasMaxLength(80).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.CodStatusRm }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // DEPENDENTES
        modelBuilder.Entity<Dependente>(b =>
        {
            b.ToTable("Dependentes");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeCompleto).HasMaxLength(200).IsRequired();
            b.Property(x => x.Cpf).HasMaxLength(14);
            b.HasOne(x => x.Funcionario).WithMany().HasForeignKey(x => x.FuncionarioId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.FuncionarioId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // DOCUMENTOS COLABORADOR
        modelBuilder.Entity<DocumentoColaborador>(b =>
        {
            b.ToTable("DocumentosColaborador");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeArquivo).HasMaxLength(260).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            b.Property(x => x.StoragePath).HasMaxLength(500).IsRequired();
            b.Property(x => x.ObservacaoRh).HasMaxLength(500);
            b.HasOne(x => x.Funcionario).WithMany().HasForeignKey(x => x.FuncionarioId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.FuncionarioId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PRÉ-ADMISSÃO
        modelBuilder.Entity<PreAdmissao>(b =>
        {
            b.ToTable("PreAdmissoes");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Cpf).HasMaxLength(14);
            b.Property(x => x.Email).HasMaxLength(180);
            b.Property(x => x.Salario).HasColumnType("decimal(18,2)");
            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.RevisadoPor).WithMany().HasForeignKey(x => x.RevisadoPorId).OnDelete(DeleteBehavior.NoAction);
            b.HasOne(x => x.AprovadoPor).WithMany().HasForeignKey(x => x.AprovadoPorId).OnDelete(DeleteBehavior.NoAction);
            b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.CentroCusto).WithMany().HasForeignKey(x => x.CentroCustoId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.JobPosition).WithMany().HasForeignKey(x => x.JobPositionId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.SetNull);
            b.Property(x => x.AccessToken).HasMaxLength(64);
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.Cpf });
            b.HasIndex(x => new { x.TenantId, x.AccessToken }).HasFilter("\"AccessToken\" IS NOT NULL");
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PRÉ-ADMISSÃO DEPENDENTES
        modelBuilder.Entity<PreAdmissaoDependente>(b =>
        {
            b.ToTable("PreAdmissaoDependentes");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeCompleto).HasMaxLength(200).IsRequired();
            b.Property(x => x.Cpf).HasMaxLength(14);
            b.HasOne(x => x.PreAdmissao).WithMany(p => p.Dependentes).HasForeignKey(x => x.PreAdmissaoId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.PreAdmissaoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PRÉ-ADMISSÃO DOCUMENTOS SOLICITADOS
        modelBuilder.Entity<PreAdmissaoDocumentoSolicitado>(b =>
        {
            b.ToTable("PreAdmissaoDocumentosSolicitados");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasOne(x => x.PreAdmissao).WithMany(p => p.DocumentosSolicitados).HasForeignKey(x => x.PreAdmissaoId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.PreAdmissaoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PRÉ-ADMISSÃO DOCUMENTOS
        modelBuilder.Entity<PreAdmissaoDocumento>(b =>
        {
            b.ToTable("PreAdmissaoDocumentos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeArquivo).HasMaxLength(260).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
            b.Property(x => x.StoragePath).HasMaxLength(500).IsRequired();
            b.Property(x => x.ObservacaoRh).HasMaxLength(500);
            b.HasOne(x => x.PreAdmissao).WithMany(p => p.Documentos).HasForeignKey(x => x.PreAdmissaoId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.PreAdmissaoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // FAIXAS SALARIAIS
        modelBuilder.Entity<FaixaSalarial>(b =>
        {
            b.ToTable("FaixasSalariais");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EstabelecimentoCodigo).HasMaxLength(10);
            b.Property(x => x.SalarioMinimo).HasColumnType("decimal(18,2)");
            b.Property(x => x.SalarioMaximo).HasColumnType("decimal(18,2)");
            b.HasOne(x => x.JobPosition).WithMany().HasForeignKey(x => x.JobPositionId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.JobPositionId, x.EstabelecimentoCodigo });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // NÍVEIS HIERÁRQUICOS
        modelBuilder.Entity<NivelHierarquico>(b =>
        {
            b.ToTable("NiveisHierarquicos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PROJETOS DE VAGA (Sprint 3)
        modelBuilder.Entity<ProjetoVaga>(b =>
        {
            b.ToTable("ProjetosVaga");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(240);
            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.VagaId, x.Numero }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ProjetoCandidato>(b =>
        {
            b.ToTable("ProjetoCandidatos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Observacoes).HasMaxLength(2000);
            b.HasOne(x => x.Projeto).WithMany().HasForeignKey(x => x.ProjetoId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.FaseAtual).WithMany().HasForeignKey(x => x.FaseAtualId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.ProjetoId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // FASES DO PROCESSO (Sprint 4)
        modelBuilder.Entity<FaseProcesso>(b =>
        {
            b.ToTable("FasesProcesso");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.HasOne(x => x.Projeto).WithMany().HasForeignKey(x => x.ProjetoId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.ProjetoId, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // CAMPOS PERSONALIZADOS DE VAGA (Sprint 5)
        modelBuilder.Entity<CampoPersonalizadoVaga>(b =>
        {
            b.ToTable("CamposPersonalizadosVaga");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Label).HasMaxLength(200).IsRequired();
            b.Property(x => x.Opcoes).HasMaxLength(1000);
            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.VagaId, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // RESPOSTAS DE CAMPOS PERSONALIZADOS
        modelBuilder.Entity<RespostaCampoPersonalizadoVaga>(b =>
        {
            b.ToTable("RespostasCampoPersonalizadoVaga");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ValorTexto).HasMaxLength(2000);
            b.HasOne(x => x.Vaga).WithMany().HasForeignKey(x => x.VagaId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Campo).WithMany().HasForeignKey(x => x.CampoId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.VagaId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // LOG DE COMUNICAÇÃO (Sprint 6)
        modelBuilder.Entity<LogComunicacao>(b =>
        {
            b.ToTable("LogsComunicacao");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Assunto).HasMaxLength(200);
            b.Property(x => x.Mensagem).HasMaxLength(4000);
            b.Property(x => x.Destinatario).HasMaxLength(200);
            b.Property(x => x.UsuarioNome).HasMaxLength(120);
            b.HasOne(x => x.Candidato).WithMany().HasForeignKey(x => x.CandidatoId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Projeto).WithMany().HasForeignKey(x => x.ProjetoId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.CandidatoId, x.DataUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // APROVAÇÃO FAIXA SALARIAL (Gap Fix)
        modelBuilder.Entity<AprovacaoFaixaSalarial>(b =>
        {
            b.ToTable("AprovacoesFaixaSalarial");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Justificativa).HasMaxLength(1000);
            b.Property(x => x.ObservacaoAprovador).HasMaxLength(500);
            b.Property(x => x.ValorProposto).HasPrecision(18, 2);
            b.HasOne(x => x.FaixaSalarial).WithMany().HasForeignKey(x => x.FaixaSalarialId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Solicitante).WithMany().HasForeignKey(x => x.SolicitanteId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.Aprovador).WithMany().HasForeignKey(x => x.AprovadorId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // PERMISSAO NIVEL VAGA
        modelBuilder.Entity<PermissaoNivelVaga>(b =>
        {
            b.ToTable("PermissoesNivelVaga");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasOne(x => x.NivelHierarquico).WithMany().HasForeignKey(x => x.NivelHierarquicoId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Role).WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.NivelHierarquicoId, x.RoleId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // VAGAS
        modelBuilder.Entity<Vaga>(b =>
        {
            b.ToTable("Vagas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Codigo).HasMaxLength(40);
            b.Property(x => x.Titulo).HasMaxLength(160).IsRequired();

            b.Property(x => x.CodigoInterno).HasMaxLength(40);
            b.Property(x => x.CodigoCbo).HasMaxLength(20);

            b.Property(x => x.GestorRequisitante).HasMaxLength(120);
            b.Property(x => x.RecrutadorResponsavel).HasMaxLength(120);
            b.Property(x => x.PublicoAfirmativo).HasMaxLength(120);

            // Integração TOTVS RM (refactor 2026-04-26)
            b.Property(x => x.IdReqRmOrigem).HasMaxLength(40);
            b.Property(x => x.OrigemTipo).HasConversion<short>();
            b.HasIndex(x => x.OrigemTipo);
            b.HasIndex(x => x.IdReqRmOrigem);
            b.HasOne(x => x.Hierarquia)
                .WithMany()
                .HasForeignKey(x => x.HierarquiaId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.OrigemDesligamento)
                .WithMany()
                .HasForeignKey(x => x.OrigemDesligamentoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.Property(x => x.ProjetoNome).HasMaxLength(160);
            b.Property(x => x.ProjetoClienteAreaImpactada).HasMaxLength(160);
            b.Property(x => x.ProjetoPrazoPrevisto).HasMaxLength(80);

            b.Property(x => x.Cep).HasMaxLength(12);
            b.Property(x => x.Logradouro).HasMaxLength(160);
            b.Property(x => x.Numero).HasMaxLength(20);
            b.Property(x => x.Bairro).HasMaxLength(120);
            b.Property(x => x.Cidade).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);

            b.HasOne(x => x.Empresa)
                .WithMany()
                .HasForeignKey(x => x.EmpresaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Unit)
                .WithMany()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.EmpresaId);
            b.HasIndex(x => new { x.TenantId, x.UnitId });

            b.Property(x => x.PoliticaTrabalho).HasMaxLength(200);
            b.Property(x => x.ObservacoesDeslocamento).HasMaxLength(200);
            b.Property(x => x.ObservacoesRemuneracao).HasMaxLength(240);

            // Decimais
            b.Property(x => x.SalarioMinimo).HasPrecision(18, 2);
            b.Property(x => x.SalarioMaximo).HasPrecision(18, 2);

            // CentroCusto (FK + Navegação) — absorveu Area + Department em 31.2.
            b.Property(x => x.CentroCustoId).IsRequired(false);

            b.HasOne(x => x.CentroCusto)
                .WithMany()
                .HasForeignKey(x => x.CentroCustoId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.RecrutadorResponsavelUser)
                .WithMany()
                .HasForeignKey(x => x.RecrutadorResponsavelUserId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.GestorRequisitanteFuncionario)
                .WithMany()
                .HasForeignKey(x => x.GestorRequisitanteFuncionarioId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.GestorRequisitanteFuncionarioId);

            b.HasOne(x => x.EixoVaga)
                .WithMany()
                .HasForeignKey(x => x.EixoVagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.EixoVagaId);

            // Sessão 31.8 — FK para DescricaoCargo (template DNALIO consumido pelo matching)
            b.HasOne(x => x.DescricaoCargo)
                .WithMany()
                .HasForeignKey(x => x.DescricaoCargoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.DescricaoCargoId);

            // Relacionamentos (listas do modal)
            b.HasMany(x => x.Beneficios)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Requisitos)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Etapas)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.PerguntasTriagem)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices úteis
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.CentroCustoId });

            // Multi-tenant
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaBeneficio>(b =>
        {
            b.ToTable("VagaBeneficios");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaRequisito>(b =>
        {
            b.ToTable("VagaRequisitos");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
            // SkillId column may not exist yet (migration AddSkillsTaxonomy.sql pending).
            // Ignore until migration is applied to avoid "column v1.SkillId does not exist".
            b.Ignore(x => x.Skill);
            b.Ignore(x => x.SkillId);
        });

        modelBuilder.Entity<VagaEtapa>(b =>
        {
            b.ToTable("VagaEtapas");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaPergunta>(b =>
        {
            b.ToTable("VagaPerguntas");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Candidato>(b =>
        {
            b.ToTable("Candidatos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Email).HasMaxLength(180).IsRequired();
            b.Property(x => x.Fone).HasMaxLength(40);
            b.Property(x => x.Cidade).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);
            b.Property(x => x.Obs).HasMaxLength(2000);
            b.Property(x => x.PortalAccessKey).HasMaxLength(80);
            b.Property(x => x.PortalPasswordHash).HasMaxLength(400);
            b.Property(x => x.ApplicationRecruiterUserId).HasMaxLength(120);
            b.Property(x => x.ApplicationRecruiterUserName).HasMaxLength(200);

            // VagaId = cache da candidatura ativa mais recente (source of truth = tabela Candidaturas).
            // Sincronização via CandidaturaService.RecalcularVagaPrincipalAsync.
            b.Property(x => x.VagaId).IsRequired(false);

            b.HasIndex(x => new { x.TenantId, x.Email });
            b.HasIndex(x => new { x.TenantId, x.VagaId });

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Talento)
                .WithMany(x => x.Candidaturas)
                .HasForeignKey(x => x.TalentoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Documentos)
                .WithOne(x => x.Candidato)
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoDocumento>(b =>
        {
            b.ToTable("CandidatoDocumentos");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeArquivo).HasMaxLength(200).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(120);
            b.Property(x => x.Descricao).HasMaxLength(240);
            b.Property(x => x.StorageFileName).HasMaxLength(260);
            b.Property(x => x.Url).HasMaxLength(400);
            b.Property(x => x.ArquivoNome).HasMaxLength(260);
            b.Property(x => x.DataReferencia).HasMaxLength(20);

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasIndex(x => new { x.TenantId, x.VagaId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoReferencia>(b =>
        {
            b.ToTable("CandidatoReferencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Relacao).HasMaxLength(80);
            b.Property(x => x.Empresa).HasMaxLength(160);
            b.Property(x => x.Cargo).HasMaxLength(120);
            b.Property(x => x.Contato).HasMaxLength(220);
            b.Property(x => x.Periodo).HasMaxLength(60);
            b.Property(x => x.Linkedin).HasMaxLength(260);
            b.Property(x => x.Observacoes).HasMaxLength(1200);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoAcessibilidade>(b =>
        {
            b.ToTable("CandidatoAcessibilidades");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Idioma).HasMaxLength(40);
            b.Property(x => x.Canal).HasMaxLength(40);
            b.Property(x => x.MelhorHorario).HasMaxLength(40);
            b.Property(x => x.ObservacoesComunicacao).HasMaxLength(400);
            b.Property(x => x.DetalhesNecessidades).HasMaxLength(1200);
            b.Property(x => x.PcdIdentificacao).HasMaxLength(40);
            b.Property(x => x.PcdTipo).HasMaxLength(60);
            b.Property(x => x.PcdComprovacao).HasMaxLength(40);
            b.Property(x => x.PcdObservacoes).HasMaxLength(1200);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoAgendaPreferencia>(b =>
        {
            b.ToTable("CandidatoAgendaPreferencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.FormatoEntrevista).HasMaxLength(40);
            b.Property(x => x.InicioDisponivel).HasMaxLength(40);
            b.Property(x => x.AvisoPrevio).HasMaxLength(40);
            b.Property(x => x.Observacoes).HasMaxLength(400);
            b.Property(x => x.HorarioPreferido).HasMaxLength(40);
            b.Property(x => x.FusoHorario).HasMaxLength(60);

            b.HasOne(x => x.Candidato)
                .WithOne(c => c.AgendaPreferencia)
                .HasForeignKey<CandidatoAgendaPreferencia>(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoAgendaBloqueio>(b =>
        {
            b.ToTable("CandidatoAgendaBloqueios");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40);
            b.Property(x => x.Titulo).HasMaxLength(120);
            b.Property(x => x.Data).HasMaxLength(40);
            b.Property(x => x.Horario).HasMaxLength(40);
            b.Property(x => x.Observacoes).HasMaxLength(400);

            b.HasOne(x => x.Candidato)
                .WithMany(c => c.AgendaBloqueios)
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoNotificacaoPreferencia>(b =>
        {
            b.ToTable("CandidatoNotificacaoPreferencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Frequencia).HasMaxLength(40);
            b.Property(x => x.Idioma).HasMaxLength(20);
            b.Property(x => x.Email).HasMaxLength(180);
            b.Property(x => x.Telefone).HasMaxLength(40);
            b.Property(x => x.SilencioAtivo).HasMaxLength(10);
            b.Property(x => x.SilencioInicio).HasMaxLength(10);
            b.Property(x => x.SilencioFim).HasMaxLength(10);
            b.Property(x => x.SilencioPrioridade).HasMaxLength(20);
            b.Property(x => x.Assinatura).HasMaxLength(200);

            b.HasOne(x => x.Candidato)
                .WithOne(c => c.NotificacaoPreferencia)
                .HasForeignKey<CandidatoNotificacaoPreferencia>(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.CandidatoId).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoPortalNotificacao>(b =>
        {
            b.ToTable("CandidatoPortalNotificacoes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(60).IsRequired();
            b.Property(x => x.Titulo).HasMaxLength(160).IsRequired();
            b.Property(x => x.Mensagem).HasMaxLength(2000).IsRequired();
            b.Property(x => x.CriadaPorNome).HasMaxLength(200);

            b.HasOne(x => x.Candidato)
                .WithMany(c => c.PortalNotificacoes)
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Candidatura)
                .WithMany()
                .HasForeignKey(x => x.CandidaturaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId, x.CreatedAtUtc });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId, x.ResolvidaEmUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoLgpdConsent>(b =>
        {
            b.ToTable("CandidatoLgpdConsents");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Compartilhamento).HasConversion<short>();

            b.HasOne(x => x.Candidato)
                .WithOne(c => c.LgpdConsent)
                .HasForeignKey<CandidatoLgpdConsent>(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.CandidatoId).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoCompetencia>(b =>
        {
            b.ToTable("CandidatoCompetencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            b.Property(x => x.Nivel).HasMaxLength(40).IsRequired();
            b.Property(x => x.Evidencia).HasMaxLength(300);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoCertificacao>(b =>
        {
            b.ToTable("CandidatoCertificacoes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Instituicao).HasMaxLength(160);
            b.Property(x => x.Ano).HasMaxLength(10);
            b.Property(x => x.Link).HasMaxLength(260);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoPortfolio>(b =>
        {
            b.ToTable("CandidatoPortfolios");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.WorkModel).HasMaxLength(40);
            b.Property(x => x.Availability).HasMaxLength(40);
            b.Property(x => x.Salary).HasMaxLength(40);
            b.Property(x => x.Shift).HasMaxLength(40);
            b.Property(x => x.Note).HasMaxLength(200);
            b.Property(x => x.Linkedin).HasMaxLength(260);
            b.Property(x => x.Github).HasMaxLength(260);
            b.Property(x => x.Portfolio).HasMaxLength(260);
            b.Property(x => x.Drive).HasMaxLength(260);
            b.Property(x => x.Tags).HasMaxLength(400);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoEducacaoResumo>(b =>
        {
            b.ToTable("CandidatoEducacaoResumos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nivel).HasMaxLength(60);
            b.Property(x => x.AreaPrincipal).HasMaxLength(120);
            b.Property(x => x.Situacao).HasMaxLength(40);
            b.Property(x => x.DataConclusao).HasMaxLength(20);
            b.Property(x => x.Destaques).HasMaxLength(260);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoEducacaoItem>(b =>
        {
            b.ToTable("CandidatoEducacaoItens");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Curso).HasMaxLength(160).IsRequired();
            b.Property(x => x.Instituicao).HasMaxLength(160);
            b.Property(x => x.Tipo).HasMaxLength(40);
            b.Property(x => x.Status).HasMaxLength(40);
            b.Property(x => x.Inicio).HasMaxLength(20);
            b.Property(x => x.Fim).HasMaxLength(20);
            b.Property(x => x.Observacoes).HasMaxLength(800);
            b.Property(x => x.Link).HasMaxLength(260);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoExperiencia>(b =>
        {
            b.ToTable("CandidatoExperiencias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Empresa).HasMaxLength(160).IsRequired();
            b.Property(x => x.Cargo).HasMaxLength(160).IsRequired();
            b.Property(x => x.Inicio).HasMaxLength(20);
            b.Property(x => x.Fim).HasMaxLength(20);
            b.Property(x => x.Local).HasMaxLength(160);
            b.Property(x => x.Atividades).HasMaxLength(2400);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoProjeto>(b =>
        {
            b.ToTable("CandidatoProjetos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Periodo).HasMaxLength(60);
            b.Property(x => x.Descricao).HasMaxLength(600);
            b.Property(x => x.Link).HasMaxLength(260);
            b.Property(x => x.Stack).HasMaxLength(400);
            b.Property(x => x.Destaques).HasMaxLength(1600);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoPreferenciasVaga>(b =>
        {
            b.ToTable("CandidatoPreferenciasVaga");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CargoAlvo).HasMaxLength(160);
            b.Property(x => x.Senioridade).HasMaxLength(60);
            b.Property(x => x.InicioDisponivel).HasMaxLength(60);
            b.Property(x => x.Resumo).HasMaxLength(1200);
            b.Property(x => x.AreasInteresse).HasMaxLength(240);
            b.Property(x => x.ModeloTrabalho).HasMaxLength(40);
            b.Property(x => x.Jornada).HasMaxLength(40);
            b.Property(x => x.TipoContrato).HasMaxLength(40);
            b.Property(x => x.Viagens).HasMaxLength(40);
            b.Property(x => x.Mudanca).HasMaxLength(40);
            b.Property(x => x.CidadePreferida).HasMaxLength(160);
            b.Property(x => x.DistanciaMaxKm).HasMaxLength(20);
            b.Property(x => x.ObsDeslocamento).HasMaxLength(200);
            b.Property(x => x.PretensaoSalarial).HasMaxLength(40);
            b.Property(x => x.PretensaoNegociavel).HasMaxLength(40);
            b.Property(x => x.BeneficiosDesejados).HasMaxLength(200);
            b.Property(x => x.NaoAbreMaoDe).HasMaxLength(200);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoStatusHistory>(b =>
        {
            b.ToTable("CandidatoStatusHistories");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Reason).HasMaxLength(120);
            b.Property(x => x.Note).HasMaxLength(400);
            b.Property(x => x.Source).HasMaxLength(60);
            b.Property(x => x.UserId).HasMaxLength(120);
            b.Property(x => x.UserName).HasMaxLength(200);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasIndex(x => new { x.TenantId, x.CandidatoId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoVagaMatchingScore>(b =>
        {
            b.ToTable("CandidatoVagaMatchingScores");
            b.HasKey(x => new { x.CandidatoId, x.VagaId });
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Score).IsRequired();
            b.Property(x => x.ScoreCompetencia);
            b.Property(x => x.ScoreExperiencia);
            b.Property(x => x.ScoreFormacao);
            b.Property(x => x.ScoreLocalidade);
            b.Property(x => x.Source).HasMaxLength(20);
            b.Property(x => x.Justificativa).HasMaxLength(2000);
            b.Property(x => x.RuleVersion).HasMaxLength(30);
            b.Property(x => x.CalculatedAtUtc).IsRequired();
            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.VagaId, x.Score });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaUnifiedMatchingCache>(b =>
        {
            b.ToTable("VagaUnifiedMatchingCaches");
            b.HasKey(x => x.VagaId);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CurrentFiltersHash).HasMaxLength(64).IsRequired();
            b.Property(x => x.PendingFiltersHash).HasMaxLength(64);
            b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

            // jsonb no Postgres; armazenamos o array de itens retornado pela IA
            b.Property(x => x.ItemsJson).HasColumnType("jsonb");
            b.Property(x => x.LastError).HasMaxLength(2000);

            b.Property(x => x.StartedAtUtc);
            b.Property(x => x.ComputedAtUtc);
            b.Property(x => x.LastAccessAtUtc);

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.VagaId }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Skill>(b =>
        {
            b.ToTable("Skills");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CanonicalName).HasMaxLength(180).IsRequired();
            b.Property(x => x.Category).HasMaxLength(80);
            b.HasOne(x => x.ParentSkill).WithMany().HasForeignKey(x => x.ParentSkillId).OnDelete(DeleteBehavior.SetNull);
            b.HasMany(x => x.Aliases).WithOne(x => x.Skill).HasForeignKey(x => x.SkillId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.CanonicalName }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SkillAlias>(b =>
        {
            b.ToTable("SkillAliases");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.AliasName).HasMaxLength(180).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.AliasName }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RecruiterMatchingFeedback>(b =>
        {
            b.ToTable("RecruiterMatchingFeedbacks");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.RecruiterUserId).HasMaxLength(120);
            b.Property(x => x.Action).HasConversion<short>();
            b.HasIndex(x => new { x.VagaId, x.CandidatoId });
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<BatchMatchingRun>(b =>
        {
            b.ToTable("BatchMatchingRuns");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasConversion<short>();
            b.Property(x => x.LastError).HasMaxLength(2000);
            b.HasMany(x => x.Vagas).WithOne(x => x.Run).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<BatchMatchingRunVaga>(b =>
        {
            b.ToTable("BatchMatchingRunVagas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasConversion<short>();
            b.Property(x => x.ErrorMessage).HasMaxLength(2000);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EmailMessage>(b =>
        {
            b.ToTable("EmailMessages");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.OwnerUserId).HasMaxLength(120);
            b.Property(x => x.OwnerUserName).HasMaxLength(200);
            b.Property(x => x.Source).HasMaxLength(120);
            b.Property(x => x.To).HasMaxLength(320).IsRequired();
            b.Property(x => x.Cc).HasMaxLength(640);
            b.Property(x => x.Bcc).HasMaxLength(640);
            b.Property(x => x.Subject).HasMaxLength(260).IsRequired();
            b.Property(x => x.TemplateName).HasMaxLength(120);
            b.Property(x => x.LastError).HasMaxLength(1200);

            b.HasMany(x => x.Attempts)
                .WithOne(x => x.EmailMessage)
                .HasForeignKey(x => x.EmailMessageId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Attachments)
                .WithOne(x => x.EmailMessage)
                .HasForeignKey(x => x.EmailMessageId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.OwnerUserId });
            b.HasIndex(x => new { x.TenantId, x.IsSystem });
            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EmailMessageAttachment>(b =>
        {
            b.ToTable("EmailMessageAttachments");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(160);
            b.Property(x => x.ContentBytes).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.EmailMessageId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EmailConfig>(b =>
        {
            b.ToTable("EmailConfigs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Provider).HasMaxLength(20).IsRequired();
            b.Property(x => x.SmtpHost).HasMaxLength(200);
            b.Property(x => x.SmtpUserName).HasMaxLength(200);
            b.Property(x => x.SmtpFromName).HasMaxLength(200);
            b.Property(x => x.SmtpFromAddress).HasMaxLength(200);
            b.Property(x => x.ImapHost).HasMaxLength(200);
            b.Property(x => x.ImapUserName).HasMaxLength(200);

            b.HasIndex(x => new { x.TenantId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EntraIdConfig>(b =>
        {
            b.ToTable("EntraIdConfigs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EntraTenantId).HasMaxLength(120);
            b.Property(x => x.ClientId).HasMaxLength(120);
            b.Property(x => x.ClientSecretEncrypted).HasMaxLength(400);
            b.Property(x => x.CallbackPath).HasMaxLength(500);
            b.Property(x => x.FrontendBaseUrl).HasMaxLength(500);
            b.Property(x => x.IsEnabled).IsRequired();

            b.HasIndex(x => new { x.TenantId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TenantConfiguracao>(b =>
        {
            b.ToTable("TenantConfiguracoes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.RmRequisicaoCreateEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.RmRequisicaoGetEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.RmRequisicaoParecerEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.RmRequisicaoCreateUsername).HasMaxLength(200);
            b.Property(x => x.RmRequisicaoCreatePassword).HasMaxLength(500);
            b.Property(x => x.RequisicoesVagaOrigemRm).HasDefaultValue(false);
            b.Property(x => x.RmImportacaoAutomaticaAtiva).HasDefaultValue(false);
            b.Property(x => x.RmImportacaoAutomaticaIntervaloMinutos).HasDefaultValue(15);
            b.Property(x => x.RmImportacaoAutomaticaMaxPorExecucao).HasDefaultValue(50);

            b.Property(x => x.UsarIaParseCurriculo).HasDefaultValue(true);
            b.Property(x => x.LlmTimeoutSeconds).HasDefaultValue(180);

            b.HasOne(x => x.AprovadorRh)
                .WithMany()
                .HasForeignKey(x => x.AprovadorRhId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => x.TenantId).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TenantRmConfiguracao>(b =>
        {
            b.ToTable("TenantRmConfiguracoes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.SqlServer).HasMaxLength(200);
            b.Property(x => x.SqlDatabase).HasMaxLength(200);
            b.Property(x => x.SqlUserId).HasMaxLength(200);
            b.Property(x => x.SqlPasswordEncrypted).HasMaxLength(1000);
            b.Property(x => x.SqlApplicationIntent).HasMaxLength(40);
            b.Property(x => x.Mode).HasMaxLength(40).IsRequired();
            b.Property(x => x.CreateEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.GetEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.ParecerEndpointUrl).HasMaxLength(1000);
            b.Property(x => x.RestUsername).HasMaxLength(200);
            b.Property(x => x.RestPasswordEncrypted).HasMaxLength(1000);
            b.Property(x => x.RestBearerTokenEncrypted).HasMaxLength(2000);
            b.Property(x => x.RecCreatedBy).HasMaxLength(60).IsRequired();
            b.Property(x => x.RecModifiedBy).HasMaxLength(60).IsRequired();
            b.Property(x => x.SyncOnlyEmail).HasMaxLength(240);
            b.Property(x => x.VagaDefaultAreaCode).HasMaxLength(80);
            b.Property(x => x.Schema).HasMaxLength(80).IsRequired();
            b.Property(x => x.AreaTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.DepartamentoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.FuncaoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.CargoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.VagaTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.UnidadeTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.FuncionarioTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.PessoaTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.HierarquiaTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.HierarquiaColigadaExternaTable).HasMaxLength(160);
            b.Property(x => x.DesligamentoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.AumentoQuadroTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.SubstituicaoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.TransferenciaPromocaoTable).HasMaxLength(160).IsRequired();
            b.Property(x => x.GestoresRmUrlTemplate).HasMaxLength(2048);
            b.Property(x => x.GestoresRmUser).HasMaxLength(200);
            b.Property(x => x.GestoresRmPasswordEncrypted).HasMaxLength(1000);

            b.HasIndex(x => x.TenantId).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TenantBranding>(b =>
        {
            b.ToTable("TenantBrandings");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomePortal).HasMaxLength(80);
            b.Property(x => x.Subtitulo).HasMaxLength(160);
            b.Property(x => x.RodapeTexto).HasMaxLength(160);
            b.Property(x => x.CorPrimariaHex).HasMaxLength(7);
            b.Property(x => x.CorSecundariaHex).HasMaxLength(7);
            b.Property(x => x.LogoUrl).HasMaxLength(512);
            b.Property(x => x.VersaoExibida).HasMaxLength(32);

            b.HasIndex(x => x.TenantId).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EtapaConfigAprovacao>(b =>
        {
            b.ToTable("EtapasConfigAprovacao");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Label).HasMaxLength(120).IsRequired();
            b.Property(x => x.Ativo).IsRequired();

            b.HasOne(x => x.FuncionarioFixo)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioFixoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.RoleFila)
                .WithMany()
                .HasForeignKey(x => x.RoleFilaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.TipoFluxo, x.Ordem }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<FluxoAprovacaoConfig>(b =>
        {
            b.ToTable("FluxosAprovacaoConfig");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.TipoFluxo }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SolicitacaoAprovacaoEtapa>(b =>
        {
            b.ToTable("SolicitacoesAprovacaoEtapas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Label).HasMaxLength(120).IsRequired();

            b.HasOne(x => x.Aprovador)
                .WithMany()
                .HasForeignKey(x => x.AprovadorId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.SolicitacaoId, x.TipoFluxo });
            b.HasIndex(x => new { x.TenantId, x.RoleFilaId, x.Status })
                .HasFilter("\"RoleFilaId\" IS NOT NULL");
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ApprovalMagicLink>(b =>
        {
            b.ToTable("ApprovalMagicLinks");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Token).HasMaxLength(64).IsRequired();
            b.Property(x => x.IpAddress).HasMaxLength(45);
            b.Property(x => x.UserAgent).HasMaxLength(512);
            b.HasIndex(x => new { x.TenantId, x.Token }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<TemplateEntrevistaSaida>(b =>
        {
            b.ToTable("TemplatesEntrevistaSaida");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.Ativo });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<PerguntaEntrevistaSaida>(b =>
        {
            b.ToTable("PerguntasEntrevistaSaida");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
            b.Property(x => x.Opcoes).HasMaxLength(1000);
            b.HasOne(x => x.Template)
                .WithMany(t => t.Perguntas)
                .HasForeignKey(x => x.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.TemplateId, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EntrevistaSaida>(b =>
        {
            b.ToTable("EntrevistasSaida");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Token).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.Token }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.DesligamentoId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RespostaEntrevistaSaida>(b =>
        {
            b.ToTable("RespostasEntrevistaSaida");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ValorTexto).HasMaxLength(2000);
            b.Property(x => x.ValorOpcao).HasMaxLength(200);
            b.HasOne(x => x.Entrevista)
                .WithMany(e => e.Respostas)
                .HasForeignKey(x => x.EntrevistaId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Pergunta)
                .WithMany()
                .HasForeignKey(x => x.PerguntaId)
                .OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.TenantId, x.EntrevistaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AprovadorAlternativo>(b =>
        {
            b.ToTable("AprovadoresAlternativos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasOne(x => x.Gestor).WithMany().HasForeignKey(x => x.GestorId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Aprovador).WithMany().HasForeignKey(x => x.AprovadorId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.GestorId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<DocumentacaoPadraoConfig>(b =>
        {
            b.ToTable("DocumentacaoPadraoConfigs");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TipoDocumento).IsRequired();
            b.Property(x => x.Configuracao).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.TipoDocumento }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<DocumentacaoPadraoPorNivelCargoConfig>(b =>
        {
            b.ToTable("DocumentacaoPadraoPorNivelCargoConfigs");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NivelCargoId).IsRequired();
            b.Property(x => x.TipoDocumento).IsRequired();
            b.Property(x => x.Configuracao).IsRequired();
            b.HasOne(x => x.NivelCargo)
                .WithMany()
                .HasForeignKey(x => x.NivelCargoId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.NivelCargoId, x.TipoDocumento }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.NivelCargoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<DocumentacaoPadraoPorCargoConfig>(b =>
        {
            b.ToTable("DocumentacaoPadraoPorCargoConfigs");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.JobPositionId).IsRequired();
            b.Property(x => x.TipoDocumento).IsRequired();
            b.Property(x => x.Configuracao).IsRequired();
            b.HasOne(x => x.JobPosition)
                .WithMany()
                .HasForeignKey(x => x.JobPositionId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.JobPositionId, x.TipoDocumento }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.JobPositionId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<DocumentacaoPadraoHistorico>(b =>
        {
            b.ToTable("DocumentacaoPadraoHistoricos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Escopo).IsRequired();
            b.Property(x => x.TipoDocumento).IsRequired();
            b.Property(x => x.Acao).IsRequired();
            b.Property(x => x.UserNome).HasMaxLength(200);
            b.HasOne(x => x.NivelCargo)
                .WithMany()
                .HasForeignKey(x => x.NivelCargoId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.Cargo)
                .WithMany()
                .HasForeignKey(x => x.CargoId)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.CriadoEmUtc });
            b.HasIndex(x => new { x.TenantId, x.Escopo, x.NivelCargoId });
            b.HasIndex(x => new { x.TenantId, x.Escopo, x.CargoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // ── WorkflowRH ──────────────────────────────────────────

        modelBuilder.Entity<WorkflowRH>(b =>
        {
            b.ToTable("WorkflowsRH");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.PreAdmissao)
                .WithMany()
                .HasForeignKey(x => x.PreAdmissaoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Responsavel)
                .WithMany()
                .HasForeignKey(x => x.ResponsavelId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Etapas)
                .WithOne(x => x.Workflow)
                .HasForeignKey(x => x.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Historico)
                .WithOne(x => x.Workflow)
                .HasForeignKey(x => x.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.TipoWorkflow, x.Status });
            b.HasIndex(x => new { x.TenantId, x.VagaId })
                .HasFilter("\"VagaId\" IS NOT NULL");
            b.HasIndex(x => new { x.TenantId, x.PreAdmissaoId })
                .HasFilter("\"PreAdmissaoId\" IS NOT NULL");
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EtapaWorkflowRH>(b =>
        {
            b.ToTable("EtapasWorkflowRH");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(50).IsRequired();
            b.Property(x => x.Label).HasMaxLength(160).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(500);
            b.Property(x => x.Observacoes).HasMaxLength(2000);

            b.HasOne(x => x.Responsavel)
                .WithMany()
                .HasForeignKey(x => x.ResponsavelId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.WorkflowId, x.Ordem });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EtapaConfigWorkflowRH>(b =>
        {
            b.ToTable("EtapasConfigWorkflowRH");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(50).IsRequired();
            b.Property(x => x.Label).HasMaxLength(160).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(500);
            b.Property(x => x.Ativo).IsRequired();

            b.HasOne(x => x.RoleFila)
                .WithMany()
                .HasForeignKey(x => x.RoleFilaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.TipoWorkflow, x.Ordem }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<HistoricoAlteracaoWorkflowRH>(b =>
        {
            b.ToTable("HistoricosAlteracaoWorkflowRH");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Campo).HasMaxLength(120).IsRequired();
            b.Property(x => x.ValorAnterior).HasMaxLength(2000);
            b.Property(x => x.ValorNovo).HasMaxLength(2000);
            b.Property(x => x.AlteradoPorNome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Observacao).HasMaxLength(2000);

            b.HasOne(x => x.AlteradoPor)
                .WithMany()
                .HasForeignKey(x => x.AlteradoPorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.EtapaWorkflow)
                .WithMany()
                .HasForeignKey(x => x.EtapaWorkflowId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.WorkflowId, x.DataAlteracaoUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // ── Fim WorkflowRH ──────────────────────────────────────

        modelBuilder.Entity<ApiKey>(b =>
        {
            b.ToTable("ApiKeys");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.KeyHash).HasMaxLength(64).IsRequired();
            b.Property(x => x.Description).HasMaxLength(500);
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.KeyHash }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.Name });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<LocalizationConfig>(b =>
        {
            b.ToTable("LocalizationConfigs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Culture).HasMaxLength(20);
            b.Property(x => x.UiCulture).HasMaxLength(20);

            b.HasIndex(x => new { x.TenantId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EmailAttempt>(b =>
        {
            b.ToTable("EmailAttempts");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
            b.Property(x => x.ErrorMessage).HasMaxLength(1200);
            b.Property(x => x.ErrorStackTrace).HasMaxLength(2000);
            b.HasIndex(x => new { x.TenantId, x.EmailMessageId });
            b.HasIndex(x => new { x.TenantId, x.StartedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<EmailTemplate>(b =>
        {
            b.ToTable("EmailTemplates");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.SubjectTemplate).HasMaxLength(200).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.Name, x.Version });
            b.HasIndex(x => new { x.TenantId, x.Name, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<InboxItem>(b =>
        {
            b.ToTable("InboxItems");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Remetente).HasMaxLength(180);
            b.Property(x => x.Assunto).HasMaxLength(220);
            b.Property(x => x.Destinatario).HasMaxLength(200);
            b.Property(x => x.ProcessamentoEtapa).HasMaxLength(120);
            b.Property(x => x.ProcessamentoUltimoErro).HasMaxLength(400);
            b.Property(x => x.SuggestedVagasJson).HasColumnType("jsonb");

            b.HasIndex(x => new { x.TenantId, x.Origem });
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.RecebidoEm });

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Candidato)
                .WithMany()
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Anexos)
                .WithOne(x => x.InboxItem)
                .HasForeignKey(x => x.InboxItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<InboxAnexo>(b =>
        {
            b.ToTable("InboxAttachments");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(20);
            b.Property(x => x.Hash).HasMaxLength(120);

            b.HasIndex(x => new { x.TenantId, x.InboxItemId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AgendaEventType>(b =>
        {
            b.ToTable("AgendaEventTypes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Label).HasMaxLength(120).IsRequired();
            b.Property(x => x.Color).HasMaxLength(20).IsRequired();
            b.Property(x => x.Icon).HasMaxLength(80).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AgendaEvent>(b =>
        {
            b.ToTable("AgendaEvents");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Title).HasMaxLength(240).IsRequired();
            b.Property(x => x.Status).HasMaxLength(40).IsRequired();
            b.Property(x => x.Location).HasMaxLength(160);
            b.Property(x => x.MeetingFormat).HasMaxLength(20);
            b.Property(x => x.RoomEmail).HasMaxLength(320);
            b.Property(x => x.RoomDisplayName).HasMaxLength(160);
            b.Property(x => x.Owner).HasMaxLength(120);
            b.Property(x => x.Candidate).HasMaxLength(160);
            b.Property(x => x.VagaTitle).HasMaxLength(200);
            b.Property(x => x.VagaCode).HasMaxLength(40);
            b.Property(x => x.Notes).HasMaxLength(2000);
            b.Property(x => x.ParticipantsJson).HasMaxLength(4000);
            b.Property(x => x.CandidateConfirmationToken).HasMaxLength(80);
            b.Property(x => x.CandidateResponseStatus).HasMaxLength(40);
            b.Property(x => x.CandidateResponseMessage).HasMaxLength(1000);
            b.Property(x => x.GraphCalendarEventId).HasMaxLength(512);
            b.Property(x => x.GraphCalendarUserUpn).HasMaxLength(256);

            b.HasOne(x => x.Type)
                .WithMany()
                .HasForeignKey(x => x.TypeId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.StartAtUtc });
            b.HasIndex(x => new { x.TenantId, x.CandidateConfirmationToken });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CelebrationPost>(b =>
        {
            b.ToTable("CelebrationPosts");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Content).HasMaxLength(4000).IsRequired();

            b.HasOne(x => x.Author)
                .WithMany()
                .HasForeignKey(x => x.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CelebrationMention>(b =>
        {
            b.ToTable("CelebrationMentions");
            b.HasKey(x => x.Id);

            b.HasOne(x => x.Post)
                .WithMany(x => x.Mentions)
                .HasForeignKey(x => x.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.PostId);
        });

        modelBuilder.Entity<CelebrationComment>(b =>
        {
            b.ToTable("CelebrationComments");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.Post)
                .WithMany()
                .HasForeignKey(x => x.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Author)
                .WithMany()
                .HasForeignKey(x => x.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.PostId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CelebrationCommentMention>(b =>
        {
            b.ToTable("CelebrationCommentMentions");
            b.HasKey(x => x.Id);

            b.HasOne(x => x.Comment)
                .WithMany(x => x.Mentions)
                .HasForeignKey(x => x.CommentId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.CommentId);
            b.HasIndex(x => new { x.CommentId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<CelebrationCommentReaction>(b =>
        {
            b.ToTable("CelebrationCommentReactions");
            b.HasKey(x => x.Id);

            b.Property(x => x.Type).HasMaxLength(20).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.Comment)
                .WithMany()
                .HasForeignKey(x => x.CommentId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.CommentId);
            b.HasIndex(x => new { x.CommentId, x.Type });
            b.HasIndex(x => new { x.CommentId, x.UserId, x.Type }).IsUnique();
        });

        modelBuilder.Entity<FeedbackItem>(b =>
        {
            b.ToTable("FeedbackItems");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Content).HasMaxLength(4000).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40);
            b.Property(x => x.InternalNotes).HasMaxLength(4000);

            b.HasOne(x => x.FromUser)
                .WithMany()
                .HasForeignKey(x => x.FromUserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.ToUser)
                .WithMany()
                .HasForeignKey(x => x.ToUserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasMany(x => x.Ratings)
                .WithOne(x => x.FeedbackItem)
                .HasForeignKey(x => x.FeedbackItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasIndex(x => new { x.TenantId, x.ToUserId });
            b.HasIndex(x => new { x.TenantId, x.FromUserId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<FeedbackItemRating>(b =>
        {
            b.ToTable("FeedbackItemRatings");
            b.HasKey(x => x.Id);
            b.Property(x => x.ItemName).HasMaxLength(120).IsRequired();
            b.HasIndex(x => x.FeedbackItemId);
        });

        modelBuilder.Entity<DevelopmentPlan>(b =>
        {
            b.ToTable("DevelopmentPlans");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Title).HasMaxLength(200).IsRequired();
            b.Property(x => x.Description).HasMaxLength(2000);

            b.HasOne(x => x.OwnerUser)
                .WithMany()
                .HasForeignKey(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.TargetUser)
                .WithMany()
                .HasForeignKey(x => x.TargetUserId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.OwnerUserId });
            b.HasIndex(x => new { x.TenantId, x.TargetUserId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<DevelopmentPlanGoal>(b =>
        {
            b.ToTable("DevelopmentPlanGoals");
            b.HasKey(x => x.Id);

            b.Property(x => x.Description).HasMaxLength(500).IsRequired();

            b.HasOne(x => x.Plan)
                .WithMany(x => x.Goals)
                .HasForeignKey(x => x.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.PlanId);
        });

        modelBuilder.Entity<NineBoxAssessment>(b =>
        {
            b.ToTable("NineBoxAssessments");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Observacoes).HasMaxLength(2000);

            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Avaliador)
                .WithMany()
                .HasForeignKey(x => x.AvaliadorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.CicloAvaliacao)
                .WithMany()
                .HasForeignKey(x => x.CicloAvaliacaoId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.FuncionarioId });
            b.HasIndex(x => new { x.TenantId, x.CriadoEmUtc });
            b.HasIndex(x => new { x.TenantId, x.CicloAvaliacaoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AvaliacaoCiclo>(b =>
        {
            b.ToTable("AvaliacaoCiclos");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Periodo).HasMaxLength(50).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.HasOne(x => x.CriadoPor).WithMany().HasForeignKey(x => x.CriadoPorId).OnDelete(DeleteBehavior.Restrict);
            b.HasMany(x => x.Perguntas).WithOne(p => p.Ciclo).HasForeignKey(p => p.CicloId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(x => x.Respostas).WithOne(r => r.Ciclo).HasForeignKey(r => r.CicloId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AvaliacaoPergunta>(b =>
        {
            b.ToTable("AvaliacaoPerguntas");
            b.HasKey(x => x.Id);
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<AvaliacaoTemplate>(b =>
        {
            b.ToTable("AvaliacaoTemplates");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.PeriodoSugerido).HasMaxLength(50);
            b.HasMany(x => x.Perguntas).WithOne(p => p.Template).HasForeignKey(p => p.TemplateId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AvaliacaoTemplatePergunta>(b =>
        {
            b.ToTable("AvaliacaoTemplatePerguntas");
            b.HasKey(x => x.Id);
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<OneOnOneTemplate>(b =>
        {
            b.ToTable("OneOnOneTemplates");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.Categoria).HasMaxLength(64);
            b.HasMany(x => x.Itens).WithOne(i => i.Template).HasForeignKey(i => i.TemplateId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<OneOnOneTemplateItem>(b =>
        {
            b.ToTable("OneOnOneTemplateItens");
            b.HasKey(x => x.Id);
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<FeedbackTemplate>(b =>
        {
            b.ToTable("FeedbackTemplates");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.Categoria).HasMaxLength(64);
            b.Property(x => x.Conteudo).HasMaxLength(4000).IsRequired();
            b.Property(x => x.TipoSugerido).HasMaxLength(40);
            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyTemplate>(b =>
        {
            b.ToTable("SurveyTemplates");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.TipoSurvey).HasMaxLength(64).IsRequired();
            b.Property(x => x.CadenciaSugerida).HasMaxLength(100);
            b.HasMany(x => x.Questions).WithOne(q => q.Template).HasForeignKey(q => q.TemplateId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyTemplateQuestion>(b =>
        {
            b.ToTable("SurveyTemplateQuestions");
            b.HasKey(x => x.Id);
            b.Property(x => x.Texto).HasMaxLength(500).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(40).IsRequired();
            b.Property(x => x.OpcoesJson).HasColumnType("text");
        });

        modelBuilder.Entity<AvaliacaoResposta>(b =>
        {
            b.ToTable("AvaliacaoRespostas");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.RespostasJson).HasColumnType("text");
            b.Property(x => x.Score).HasColumnType("decimal(5,2)");
            b.HasOne(x => x.Avaliador).WithMany().HasForeignKey(x => x.AvaliadorId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Avaliando).WithMany().HasForeignKey(x => x.AvaliandoId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.TenantId, x.CicloId, x.AvaliandoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AvaliacaoConvite>(b =>
        {
            b.ToTable("AvaliacaoConvites");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasOne(x => x.Ciclo).WithMany().HasForeignKey(x => x.CicloId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Avaliador).WithMany().HasForeignKey(x => x.AvaliadorId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Avaliando).WithMany().HasForeignKey(x => x.AvaliandoId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.TenantId, x.CicloId, x.AvaliadorId, x.AvaliandoId }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.CicloId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.AvaliadorId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AvaliacaoCalibragem>(b =>
        {
            b.ToTable("AvaliacaoCalibragens");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.ScoreGestor).HasColumnType("decimal(5,2)");
            b.Property(x => x.ScoreComite).HasColumnType("decimal(5,2)");
            b.Property(x => x.JustificativaComite).HasMaxLength(2000);
            b.Property(x => x.ObservacaoDecisao).HasMaxLength(2000);
            b.HasOne(x => x.Ciclo).WithMany().HasForeignKey(x => x.CicloId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Funcionario).WithMany().HasForeignKey(x => x.FuncionarioId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.NineBoxAssessment).WithMany().HasForeignKey(x => x.NineBoxAssessmentId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => new { x.TenantId, x.CicloId, x.FuncionarioId }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.CicloId, x.Status });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Meta>(b =>
        {
            b.ToTable("Metas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Titulo).HasMaxLength(300).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.Unidade).HasMaxLength(20);
            b.Property(x => x.ValorMeta).HasColumnType("decimal(18,4)");
            b.Property(x => x.ValorAtual).HasColumnType("decimal(18,4)");

            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.CriadaPor)
                .WithMany()
                .HasForeignKey(x => x.CriadaPorId)
                .OnDelete(DeleteBehavior.Restrict);

            // OKR cascateado (Entrega 1.6 — Fase 1 Paridade Feedz): self-reference
            b.HasOne(x => x.ParentMeta)
                .WithMany(x => x.ChildMetas)
                .HasForeignKey(x => x.ParentMetaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.FuncionarioId });
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.ParentMetaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<MetaCheckin>(b =>
        {
            b.ToTable("MetaCheckins");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Comentario).HasMaxLength(2000);
            b.Property(x => x.ValorAtual).HasColumnType("decimal(18,4)");
            b.HasOne(x => x.Meta).WithMany(x => x.Checkins).HasForeignKey(x => x.MetaId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.CriadoPor).WithMany().HasForeignKey(x => x.CriadoPorId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.TenantId, x.MetaId, x.CriadoEmUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RenderCoinReward>(b =>
        {
            b.ToTable("RenderCoinRewards");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Codigo).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Descricao).HasMaxLength(2000);
            b.Property(x => x.Categoria).HasMaxLength(64);
            b.Property(x => x.ImagemUrl).HasMaxLength(500);
            b.Property(x => x.CustoCoins).HasColumnType("decimal(18,2)");
            b.HasIndex(x => new { x.TenantId, x.Codigo }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.IsActive });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RenderCoinRedemption>(b =>
        {
            b.ToTable("RenderCoinRedemptions");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Observacao).HasMaxLength(2000);
            b.Property(x => x.CoinsGastos).HasColumnType("decimal(18,2)");
            b.HasOne(x => x.Reward).WithMany(r => r.Redemptions).HasForeignKey(x => x.RewardId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.TenantId, x.UserId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.RewardId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<OneOnOneMeeting>(b =>
        {
            b.ToTable("OneOnOneMeetings");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Subject).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(4000);

            b.HasOne(x => x.Manager)
                .WithMany()
                .HasForeignKey(x => x.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Collaborator)
                .WithMany()
                .HasForeignKey(x => x.CollaboratorId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.MeetingDate });
            b.HasIndex(x => new { x.TenantId, x.ManagerId });
            b.HasIndex(x => new { x.TenantId, x.CollaboratorId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<MoodEntry>(b =>
        {
            b.ToTable("MoodEntries");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Mood).HasMaxLength(20).IsRequired();
            b.Property(x => x.Note).HasMaxLength(500);
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.UserId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RenderCoinBalance>(b =>
        {
            b.ToTable("RenderCoinBalances");
            b.HasKey(x => new { x.TenantId, x.UserId });

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Balance).HasPrecision(18, 4).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.Balance });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RenderCoinTransaction>(b =>
        {
            b.ToTable("RenderCoinTransactions");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Amount).HasPrecision(18, 4).IsRequired();
            b.Property(x => x.Reason).HasMaxLength(200);
            b.Property(x => x.SourceType).HasMaxLength(40);
            b.Property(x => x.SourceId).HasMaxLength(100);
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasIndex(x => new { x.TenantId, x.UserId, x.SourceType, x.SourceId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<GamificationDailyState>(b =>
        {
            b.ToTable("GamificationDailyStates");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.CurrentStreak).IsRequired();
            b.Property(x => x.BestStreak).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.UserId }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.LastCheckInDate });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // Surveys
        modelBuilder.Entity<Survey>(b =>
        {
            b.ToTable("Surveys");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Title).HasMaxLength(240).IsRequired();
            b.Property(x => x.Type).HasMaxLength(40);
            b.Property(x => x.DepartmentsJson).HasColumnType("jsonb");
            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyQuestion>(b =>
        {
            b.ToTable("SurveyQuestions");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Text).HasMaxLength(2000).IsRequired();
            b.Property(x => x.Type).HasMaxLength(40);
            b.HasIndex(x => new { x.TenantId, x.SurveyId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyOption>(b =>
        {
            b.ToTable("SurveyOptions");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Text).HasMaxLength(400).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.QuestionId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyResponse>(b =>
        {
            b.ToTable("SurveyResponses");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.SubmittedAtUtc).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.SurveyId });
            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasIndex(x => new { x.TenantId, x.SurveyId, x.UserId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SurveyAnswer>(b =>
        {
            b.ToTable("SurveyAnswers");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TextAnswer).HasMaxLength(2000);
            b.HasIndex(x => new { x.TenantId, x.ResponseId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Notification>(b =>
        {
            b.ToTable("Notifications");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.UserId);
            b.Property(x => x.Title).HasMaxLength(200).IsRequired();
            b.Property(x => x.Message).HasMaxLength(2000).IsRequired();
            b.Property(x => x.Level).HasMaxLength(20).IsRequired();
            b.Property(x => x.Url).HasMaxLength(500);
            b.Property(x => x.IsRead).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();

            b.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.CreatedAtUtc });
            b.HasIndex(x => new { x.TenantId, x.UserId, x.CreatedAtUtc });
            b.HasIndex(x => new { x.TenantId, x.IsRead });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<NotificationReceipt>(b =>
        {
            b.ToTable("NotificationReceipts");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NotificationId).IsRequired();
            b.Property(x => x.UserId).IsRequired();
            b.Property(x => x.SeenAtUtc);
            b.Property(x => x.ReadAtUtc);
            b.Property(x => x.CreatedAtUtc).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.NotificationId });
            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasIndex(x => new { x.TenantId, x.NotificationId, x.UserId }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditTransaction>(b =>
        {
            b.ToTable("AuditTransactions");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TransactionId).HasMaxLength(120).IsRequired();
            b.Property(x => x.CorrelationId).HasMaxLength(200);
            b.Property(x => x.TraceId).HasMaxLength(200);
            b.Property(x => x.SpanId).HasMaxLength(200);
            b.Property(x => x.ParentSpanId).HasMaxLength(200);
            b.Property(x => x.Environment).HasMaxLength(40);
            b.Property(x => x.AppVersion).HasMaxLength(40);
            b.Property(x => x.Method).HasMaxLength(16).IsRequired();
            b.Property(x => x.Path).HasMaxLength(512).IsRequired();
            b.Property(x => x.QueryString).HasMaxLength(1024);
            b.Property(x => x.RouteTemplate).HasMaxLength(512);
            b.Property(x => x.Controller).HasMaxLength(120);
            b.Property(x => x.Action).HasMaxLength(120);
            b.Property(x => x.UserId).HasMaxLength(120);
            b.Property(x => x.UserName).HasMaxLength(200);
            b.Property(x => x.ClientId).HasMaxLength(120);
            b.Property(x => x.Ip).HasMaxLength(80);
            b.Property(x => x.UserAgent).HasMaxLength(400);
            b.Property(x => x.Host).HasMaxLength(200);
            b.Property(x => x.RequestBodyHash).HasMaxLength(64);
            b.Property(x => x.ResponseBodyHash).HasMaxLength(64);

            b.HasIndex(x => x.TransactionId).IsUnique();
            b.HasIndex(x => x.StartedAt);
            b.HasIndex(x => new { x.TenantId, x.StartedAt });
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => x.Path);
            b.HasIndex(x => x.StatusCode);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEvent>(b =>
        {
            b.ToTable("AuditEvents");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EventType).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(200).IsRequired();
            b.Property(x => x.DataJson).HasColumnType("jsonb");

            b.HasOne(x => x.Transaction)
                .WithMany(t => t.Events)
                .HasForeignKey(x => x.AuditTransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.AuditTransactionId, x.Order });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEntityChange>(b =>
        {
            b.ToTable("AuditEntityChanges");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EntityName).HasMaxLength(200).IsRequired();
            b.Property(x => x.TableName).HasMaxLength(200);
            b.Property(x => x.State).HasMaxLength(20).IsRequired();
            b.Property(x => x.PrimaryKeyJson).HasColumnType("jsonb").IsRequired();
            b.Property(x => x.BeforeJson).HasColumnType("jsonb");
            b.Property(x => x.AfterJson).HasColumnType("jsonb");
            b.Property(x => x.ChangedColumns).HasMaxLength(500);
            b.Property(x => x.DataJson).HasColumnType("jsonb");

            b.HasOne(x => x.Transaction)
                .WithMany()
                .HasForeignKey(x => x.AuditTransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Event)
                .WithMany(e => e.EntityChanges)
                .HasForeignKey(x => x.AuditEventId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.EntityName });
            b.HasIndex(x => new { x.TenantId, x.OccurredAt });
            b.HasIndex(x => x.AuditTransactionId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEntityPropertyChange>(b =>
        {
            b.ToTable("AuditEntityPropertyChanges");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.PropertyName).HasMaxLength(200).IsRequired();
            b.Property(x => x.BeforeValue).HasMaxLength(2000);
            b.Property(x => x.AfterValue).HasMaxLength(2000);

            b.HasOne(x => x.EntityChange)
                .WithMany(c => c.PropertyChanges)
                .HasForeignKey(x => x.AuditEntityChangeId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.AuditEntityChangeId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RequestLog>(b =>
        {
            b.ToTable("RequestLogs");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TransactionId).HasMaxLength(120).IsRequired();
            b.Property(x => x.CorrelationId).HasMaxLength(200);
            b.Property(x => x.TraceId).HasMaxLength(200);
            b.Property(x => x.EnvironmentName).HasMaxLength(80).IsRequired();
            b.Property(x => x.EnvironmentNormalized).HasMaxLength(16).IsRequired();
            b.Property(x => x.DeviceId).HasMaxLength(64).IsRequired();
            b.Property(x => x.DeviceType).HasMaxLength(40);
            b.Property(x => x.Platform).HasMaxLength(40);
            b.Property(x => x.Browser).HasMaxLength(40);
            b.Property(x => x.DeviceAppVersion).HasMaxLength(120);
            b.Property(x => x.Locale).HasMaxLength(200);
            b.Property(x => x.Method).HasMaxLength(16).IsRequired();
            b.Property(x => x.Path).HasMaxLength(512).IsRequired();
            b.Property(x => x.QueryString).HasMaxLength(1024);
            b.Property(x => x.UserId).HasMaxLength(120);
            b.Property(x => x.UserName).HasMaxLength(200);
            b.Property(x => x.ClientId).HasMaxLength(120);
            b.Property(x => x.Ip).HasMaxLength(80);
            b.Property(x => x.UserAgent).HasMaxLength(400);
            b.Property(x => x.Host).HasMaxLength(200);
            b.Property(x => x.Controller).HasMaxLength(120);
            b.Property(x => x.Action).HasMaxLength(120);
            b.Property(x => x.RouteTemplate).HasMaxLength(512);
            b.Property(x => x.RequestBodySnippet).HasColumnType("text");
            b.Property(x => x.ResponseBodySnippet).HasColumnType("text");

            b.HasIndex(x => new { x.TenantId, x.StartedAt });
            b.HasIndex(x => new { x.TenantId, x.TransactionId });
            b.HasIndex(x => new { x.TenantId, x.EnvironmentNormalized, x.StartedAt });
            b.HasIndex(x => new { x.TenantId, x.DeviceId, x.StartedAt });
            b.HasIndex(x => new { x.TenantId, x.Path });
            b.HasIndex(x => new { x.TenantId, x.StatusCode });
            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<LogEntry>(b =>
        {
            b.ToTable("LogEntries");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TransactionId).HasMaxLength(120).IsRequired();
            b.Property(x => x.EnvironmentName).HasMaxLength(80).IsRequired();
            b.Property(x => x.EnvironmentNormalized).HasMaxLength(16).IsRequired();
            b.Property(x => x.DeviceId).HasMaxLength(64).IsRequired();
            b.Property(x => x.DeviceType).HasMaxLength(40);
            b.Property(x => x.Platform).HasMaxLength(40);
            b.Property(x => x.Browser).HasMaxLength(40);
            b.Property(x => x.DeviceAppVersion).HasMaxLength(120);
            b.Property(x => x.Locale).HasMaxLength(200);
            b.Property(x => x.Level).HasMaxLength(20).IsRequired();
            b.Property(x => x.Category).HasMaxLength(200).IsRequired();
            b.Property(x => x.EventName).HasMaxLength(200);
            b.Property(x => x.Message).HasMaxLength(8192).IsRequired();
            b.Property(x => x.ExceptionType).HasMaxLength(300);
            b.Property(x => x.ExceptionMessage).HasMaxLength(8192);
            b.Property(x => x.ExceptionStackTrace).HasMaxLength(16384);
            b.Property(x => x.PropertiesJson).HasColumnType("jsonb");

            b.HasIndex(x => new { x.TenantId, x.OccurredAt });
            b.HasIndex(x => new { x.TenantId, x.Level });
            b.HasIndex(x => new { x.TenantId, x.Category });
            b.HasIndex(x => new { x.TenantId, x.EnvironmentNormalized, x.OccurredAt });
            b.HasIndex(x => new { x.TenantId, x.DeviceId, x.OccurredAt });
            b.HasIndex(x => new { x.RequestLogId, x.Order });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ExceptionLog>(b =>
        {
            b.ToTable("ExceptionLogs");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TransactionId).HasMaxLength(120).IsRequired();
            b.Property(x => x.EnvironmentName).HasMaxLength(80).IsRequired();
            b.Property(x => x.EnvironmentNormalized).HasMaxLength(16).IsRequired();
            b.Property(x => x.DeviceId).HasMaxLength(64).IsRequired();
            b.Property(x => x.DeviceType).HasMaxLength(40);
            b.Property(x => x.Platform).HasMaxLength(40);
            b.Property(x => x.Browser).HasMaxLength(40);
            b.Property(x => x.DeviceAppVersion).HasMaxLength(120);
            b.Property(x => x.Locale).HasMaxLength(200);
            b.Property(x => x.ExceptionType).HasMaxLength(300).IsRequired();
            b.Property(x => x.Message).HasColumnType("text").IsRequired();
            b.Property(x => x.StackTrace).HasMaxLength(16384);
            b.Property(x => x.InnerExceptionType).HasMaxLength(300);
            b.Property(x => x.InnerMessage).HasColumnType("text");
            b.Property(x => x.ProblemTitle).HasColumnType("text");
            b.Property(x => x.ProblemDetail).HasColumnType("text");
            b.Property(x => x.ProblemType).HasMaxLength(200);
            b.Property(x => x.ValidationErrorsJson).HasColumnType("jsonb");
            b.Property(x => x.Tags).HasMaxLength(200);

            b.HasIndex(x => new { x.TenantId, x.OccurredAt });
            b.HasIndex(x => new { x.TenantId, x.ExceptionType });
            b.HasIndex(x => new { x.TenantId, x.StatusCode });
            b.HasIndex(x => new { x.TenantId, x.EnvironmentNormalized, x.OccurredAt });
            b.HasIndex(x => new { x.TenantId, x.DeviceId, x.OccurredAt });
            b.HasIndex(x => new { x.TenantId, x.TransactionId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<OcupacaoHistorico>(b =>
        {
            b.ToTable("OcupacoesHistorico");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.MotivoSaida).HasConversion<string>();

            b.HasOne(x => x.Vaga)
                .WithMany(v => v.Ocupacoes)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Funcionario)
                .WithMany()
                .HasForeignKey(x => x.FuncionarioId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.FuncionarioId, x.DataSaida });
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // ── SLA e Histórico de Status ────────────────────────────

        modelBuilder.Entity<HistoricoStatus>(b =>
        {
            b.ToTable("HistoricosStatus");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.StatusAnterior).HasMaxLength(80).IsRequired();
            b.Property(x => x.StatusNovo).HasMaxLength(80).IsRequired();
            b.Property(x => x.AlteradoPorNome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Observacao).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.TipoEntidade, x.EntidadeId });
            b.HasIndex(x => new { x.TenantId, x.AlteradoEmUtc });
            b.HasIndex(x => new { x.TenantId, x.TipoEntidade, x.DentroDoSla });
            b.HasIndex(x => new { x.TenantId, x.TipoEntidade, x.StatusNovo });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SlaStatusConfig>(b =>
        {
            b.ToTable("SlaStatusConfigs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Status).HasMaxLength(80).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.TipoEntidade, x.Status }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<SlaEtapaCandidaturaConfig>(b =>
        {
            b.ToTable("SlaEtapaCandidaturaConfigs");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Etapa).HasConversion<short>();

            b.HasIndex(x => new { x.TenantId, x.Etapa }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // Provider InMemory (testes) não suporta o tipo Pgvector.Vector — sem
        // este Ignore o ModelValidator lança InvalidOperationException, e a
        // tentativa do DI de re-resolver DbContextDependencies vira recursão
        // que estoura a pilha. Esses embeddings só fazem sentido no Postgres.
        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            modelBuilder.Entity<CandidatoEmbedding>().Ignore(e => e.Embedding);
            modelBuilder.Entity<DescricaoCargoItemEmbedding>().Ignore(e => e.Embedding);
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is ITenantEntity tenantEntity)
            {
                if (entry.State == EntityState.Added)
                    tenantEntity.TenantId = _tenantContext.TenantId;
            }

            if (entry.Entity is Tenant tenant)
            {
                if (entry.State == EntityState.Added)
                {
                    tenant.CreatedAtUtc = now;
                    tenant.UpdatedAtUtc = now;
                }

                if (entry.State == EntityState.Modified)
                    tenant.UpdatedAtUtc = now;
            }

            if (entry.Entity is ApplicationUser user)
            {
                if (entry.State == EntityState.Added)
                    user.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    user.UpdatedAtUtc = now;
            }

            if (entry.Entity is ApplicationRole role)
            {
                if (entry.State == EntityState.Added)
                    role.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    role.UpdatedAtUtc = now;
            }

            if (entry.Entity is Menu menu)
            {
                if (entry.State == EntityState.Added)
                    menu.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    menu.UpdatedAtUtc = now;
            }

            if (entry.Entity is RoleMenu roleMenu)
            {
                if (entry.State == EntityState.Added)
                    roleMenu.CreatedAtUtc = now;
            }

            // 31.2: Department foi removido — carimbos consolidados em CentroCusto.

            if (entry.Entity is Unit unit)
            {
                if (entry.State == EntityState.Added)
                    unit.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    unit.UpdatedAtUtc = now;
            }

            if (entry.Entity is JobPosition jp)
            {
                if (entry.State == EntityState.Added)
                    jp.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    jp.UpdatedAtUtc = now;
            }

            if (entry.Entity is Funcionario f)
            {
                if (entry.State == EntityState.Added)
                    f.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    f.UpdatedAtUtc = now;
            }

            if (entry.Entity is Vaga v)
            {
                if (entry.State == EntityState.Added) v.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) v.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaBeneficio vb)
            {
                if (entry.State == EntityState.Added) vb.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vb.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaRequisito vr)
            {
                if (entry.State == EntityState.Added) vr.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vr.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaEtapa ve)
            {
                if (entry.State == EntityState.Added) ve.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) ve.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaPergunta vp)
            {
                if (entry.State == EntityState.Added) vp.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vp.UpdatedAtUtc = now;
            }

            if (entry.Entity is Candidato c)
            {
                if (entry.State == EntityState.Added) c.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) c.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoDocumento cd)
            {
                if (entry.State == EntityState.Added) cd.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) cd.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoReferencia referencia)
            {
                if (entry.State == EntityState.Added) referencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) referencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoAcessibilidade acessibilidade)
            {
                if (entry.State == EntityState.Added) acessibilidade.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) acessibilidade.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoAgendaPreferencia agendaPreferencia)
            {
                if (entry.State == EntityState.Added) agendaPreferencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaPreferencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoAgendaBloqueio agendaBloqueio)
            {
                if (entry.State == EntityState.Added) agendaBloqueio.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaBloqueio.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoNotificacaoPreferencia notificacao)
            {
                if (entry.State == EntityState.Added) notificacao.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) notificacao.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoPortalNotificacao portalNotificacao)
            {
                if (entry.State == EntityState.Added) portalNotificacao.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) portalNotificacao.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoLgpdConsent lgpdConsent)
            {
                if (entry.State == EntityState.Added) lgpdConsent.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) lgpdConsent.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoCompetencia competencia)
            {
                if (entry.State == EntityState.Added) competencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) competencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoCertificacao cert)
            {
                if (entry.State == EntityState.Added) cert.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) cert.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoPortfolio portfolio)
            {
                if (entry.State == EntityState.Added) portfolio.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) portfolio.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoEducacaoResumo eduResumo)
            {
                if (entry.State == EntityState.Added) eduResumo.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) eduResumo.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoEducacaoItem eduItem)
            {
                if (entry.State == EntityState.Added) eduItem.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) eduItem.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoExperiencia experiencia)
            {
                if (entry.State == EntityState.Added) experiencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) experiencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoProjeto projeto)
            {
                if (entry.State == EntityState.Added) projeto.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) projeto.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoCompetencia talentoCompetencia)
            {
                if (entry.State == EntityState.Added) talentoCompetencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) talentoCompetencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoExperiencia talentoExperiencia)
            {
                if (entry.State == EntityState.Added) talentoExperiencia.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) talentoExperiencia.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoTreinamento talentoTreinamento)
            {
                if (entry.State == EntityState.Added) talentoTreinamento.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) talentoTreinamento.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoFormacao talentoFormacao)
            {
                if (entry.State == EntityState.Added) talentoFormacao.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) talentoFormacao.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoDocumento talentoDocumento)
            {
                if (entry.State == EntityState.Added) talentoDocumento.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) talentoDocumento.UpdatedAtUtc = now;
            }

            if (entry.Entity is TalentoCvImportJob cvImportJob)
            {
                if (entry.State == EntityState.Added) cvImportJob.CreatedAtUtc = now;
            }

            if (entry.Entity is CandidatoPreferenciasVaga preferencias)
            {
                if (entry.State == EntityState.Added) preferencias.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) preferencias.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoStatusHistory history)
            {
                if (entry.State == EntityState.Added) history.CreatedAtUtc = now;
            }

            if (entry.Entity is InboxItem inbox)
            {
                if (entry.State == EntityState.Added) inbox.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) inbox.UpdatedAtUtc = now;
            }

            if (entry.Entity is InboxAnexo inboxAnexo)
            {
                if (entry.State == EntityState.Added) inboxAnexo.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) inboxAnexo.UpdatedAtUtc = now;
            }

            if (entry.Entity is EntraIdConfig entraConfig)
            {
                if (entry.State == EntityState.Added) entraConfig.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) entraConfig.UpdatedAtUtc = now;
            }

            if (entry.Entity is ApiKey apiKey)
            {
                if (entry.State == EntityState.Added) apiKey.CreatedAtUtc = now;
            }

            if (entry.Entity is AgendaEventType agendaType)
            {
                if (entry.State == EntityState.Added) agendaType.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaType.UpdatedAtUtc = now;
            }

            if (entry.Entity is AgendaEvent agendaEvent)
            {
                if (entry.State == EntityState.Added) agendaEvent.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaEvent.UpdatedAtUtc = now;
            }

            if (entry.Entity is Notification notification)
            {
                if (entry.State == EntityState.Added) notification.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) notification.UpdatedAtUtc = now;
            }

            if (entry.Entity is NotificationReceipt receipt)
            {
                if (entry.State == EntityState.Added) receipt.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) receipt.UpdatedAtUtc = now;
            }

            if (entry.Entity is GamificationDailyState gamificationDailyState)
            {
                if (entry.State == EntityState.Added) gamificationDailyState.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) gamificationDailyState.UpdatedAtUtc = now;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
