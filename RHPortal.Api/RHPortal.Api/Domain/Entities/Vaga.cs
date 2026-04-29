using RhPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace RHPortal.Api.Domain.Entities
{
    public sealed class Vaga : ITenantEntity
    {
        public Guid Id { get; set; }
        public string TenantId { get; set; } = default!;

        // --------------------
        // Identificação e contexto
        // --------------------
        [StringLength(40)]
        public string? Codigo { get; set; }                 // vagaCodigo (ex.: MKT-JR-001)

        [Required, StringLength(160)]
        public string Titulo { get; set; } = string.Empty;  // vagaTitulo *

        [StringLength(200)]
        public string? NomeEngessado { get; set; }           // nome interno/fixo (não editável após publicação)

        public VagaAreaTime? AreaTime { get; set; }         // vagaAreaTime

        public VagaModalidade? Modalidade { get; set; }     // vagaModalidade
        public VagaStatus Status { get; set; }              // vagaStatus *
        public VagaSenioridade? Senioridade { get; set; }   // vagaSenioridade

        public int QuantidadeVagas { get; set; } = 1;        // vagaQuantidade

        /// <summary>Headcount total autorizado para esta posição (base + acréscimos aprovados via SolicitacaoVaga VagaNova).</summary>
        public int HeadcountAutorizado { get; set; } = 1;

        /// <summary>
        /// Quando true, esta vaga foi criada como posição estrutural (carga inicial a partir de funcionários existentes).
        /// Não aparece no quadro de recrutamento nem no pipeline de candidatos.
        /// </summary>
        public bool IsEstrutural { get; set; } = false;

        // --------------------
        // Headcount Provisório (Substituição)
        // --------------------

        /// <summary>
        /// Slots extras temporários criados por uma aprovação de substituição.
        /// Somados ao HeadcountAutorizado para calcular o limite total da posição durante o período de transição.
        /// </summary>
        public int HeadcountProvisorio { get; set; } = 0;

        /// <summary>
        /// Data/hora em que o headcount provisório expira e retorna ao HeadcountAutorizado original.
        /// Null quando não há provisão ativa.
        /// </summary>
        public DateTimeOffset? HeadcountProvisorioExpiresAtUtc { get; set; }

        /// <summary>
        /// Headcount aprovado pelo fluxo de gestores (VagaNova), mas aguardando decisão do RH
        /// (substituição provisória vs. aumento definitivo). Zera após a decisão ser tomada.
        /// </summary>
        public int HeadcountPendente { get; set; } = 0;

        // --------------------
        // Alerta de Vaga Sem Preenchimento
        // --------------------

        /// <summary>
        /// Data até a qual o alerta de "vaga sem preenchimento" está em snooze (silenciado).
        /// Null = sem snooze ativo.
        /// </summary>
        public DateTimeOffset? AlertaVagaSemFillSnoozeAteUtc { get; set; }

        // Histórico de ocupação dos slots desta vaga/posição
        public ICollection<OcupacaoHistorico> Ocupacoes { get; set; } = [];
        public VagaTipoContratacao? TipoContratacao { get; set; } // vagaTipoContratacao

        /// <summary>Match mínimo em % (0..100). Ex.: 70</summary>
        public int MatchMinimoPercentual { get; set; } = 70; // vagaThreshold

        // Pesos por categoria (soma ideal = 100)
        // ── Pesos calibráveis por vaga (Sessão 31.8) ────────────────────────
        // Soma esperada = 100. RH ajusta por vaga via UI; defaults preservam
        // comportamento histórico (compete/experi/formacao/local somam 100, novos
        // critérios começam em 0 e o RH redistribui ao calibrar).
        // Os pesos são consumidos pelo MatchingService que produz score por
        // categoria (Competência, Experiência, Formação, Localidade — distância
        // em km, Idioma, Conhecimento Técnico, Vivência Específica).
        public int PesoCompetencia { get; set; } = 40;
        public int PesoExperiencia { get; set; } = 30;
        public int PesoFormacao { get; set; } = 15;
        public int PesoLocalidade { get; set; } = 15;
        public int PesoIdioma { get; set; } = 0;
        public int PesoConhecimentoTecnico { get; set; } = 0;
        public int PesoVivenciaEspecifica { get; set; } = 0;

        /// <summary>
        /// Distância máxima aceitável (km) entre endereço do candidato e endereço
        /// da Empresa da vaga, para cálculo do score de Localidade. Null = usa
        /// default do tenant (50km). Distância 0 = score 100; distância >= max = score 0.
        /// </summary>
        public int? LocalidadeMaxDistanciaKm { get; set; }

        // ── Vínculo com Descrição de Cargo (Sessão 31.8) ────────────────────
        /// <summary>
        /// FK opcional para a <see cref="DescricaoCargo"/> que serve como fonte
        /// estruturada (template DNALIO) do matching. Quando preenchida, o
        /// MatchingService consulta os <see cref="DescricaoCargo.Itens"/>
        /// (atividades, vivências, competências, requisitos) em vez de campos
        /// HTML soltos da vaga.
        /// </summary>
        public Guid? DescricaoCargoId { get; set; }
        public DescricaoCargo? DescricaoCargo { get; set; }

        /// <summary>Regras/filtros atuais de matching (prompt/contexto para IA).</summary>
        public string? MatchingFiltrosRaw { get; set; }
        /// <summary>Cópia dos filtros na criação da vaga; usado para "Reverter para filtros da criação".</summary>
        public string? MatchingFiltrosOriginaisRaw { get; set; }

        public string? DescricaoInterna { get; set; }        // vagaDescricao

        [StringLength(40)]
        public string? CodigoInterno { get; set; }           // vagaCodigoInterno
        [StringLength(20)]
        public string? CodigoCbo { get; set; }               // vagaCbo

        // FK para cargo interno (JobPosition)
        public Guid? JobPositionId { get; set; }
        public JobPosition? JobPosition { get; set; }

        // FK para cadastros TOTVS
        public Guid? CategoriaSalarialId { get; set; }
        public CategoriaSalarial? CategoriaSalarial { get; set; }

        public Guid? CentroCustoId { get; set; }
        public CentroCusto? CentroCusto { get; set; }

        // ── Integração TOTVS RM (refactor 2026-04-26) ──────────────────────
        /// <summary>FK para Hierarquia (organograma TOTVS) — derivada de VREQAUMENTOQUADRO.IDHIERARQUIADESTINO ou VREQSUBSTITUICAO.IDHIERARQUIADESTINO.</summary>
        public Guid? HierarquiaId { get; set; }
        public Hierarquia? Hierarquia { get; set; }

        /// <summary>Origem da vaga (AumentoQuadro / SubstituicaoDesligamento / SubstituicaoPromocao / Direta / Manual).</summary>
        public VagaOrigemTipo OrigemTipo { get; set; } = VagaOrigemTipo.Manual;

        /// <summary>Quando OrigemTipo=SubstituicaoDesligamento, FK para o desligamento que originou.</summary>
        public Guid? OrigemDesligamentoId { get; set; }
        public Desligamento? OrigemDesligamento { get; set; }

        /// <summary>Código da requisição-mãe no RM (VREQAUMENTOQUADRO.IDREQ ou VREQSUBSTITUICAO.IDREQ). Informativo, pra rastrear no TOTVS.</summary>
        [System.ComponentModel.DataAnnotations.MaxLength(40)]
        public string? IdReqRmOrigem { get; set; }

        /// <summary>Código da função TOTVS RM (VREQAUMENTOQUADRO.CODFUNCAO ou VREQSUBSTITUICAO.CODFUNCAO).</summary>
        [System.ComponentModel.DataAnnotations.MaxLength(20)]
        public string? CodFuncaoRm { get; set; }

        /// <summary>Nome específico da função TOTVS (PFUNCAO.NOME). Ex.: "ANALISTA DE PRICING SR".</summary>
        [System.ComponentModel.DataAnnotations.MaxLength(160)]
        public string? FuncaoNomeRm { get; set; }

        public Guid? TurnoId { get; set; }
        public Turno? Turno { get; set; }

        public Guid? UnidadeLotacaoId { get; set; }
        public UnidadeLotacao? UnidadeLotacao { get; set; }

        // FK para EixoVaga (SLA por eixo pode sobrepor SlaDiasMetaFechamento)
        public Guid? EixoVagaId { get; set; }
        public EixoVaga? EixoVaga { get; set; }

        public VagaMotivoAbertura? MotivoAbertura { get; set; }   // vagaMotivoAbertura
        public VagaOrcamentoAprovado? OrcamentoAprovado { get; set; } // vagaOrcamento

        [StringLength(120)]
        public string? GestorRequisitante { get; set; }      // vagaGestor
        public Guid? GestorRequisitanteFuncionarioId { get; set; }
        public Funcionario? GestorRequisitanteFuncionario { get; set; }
        [StringLength(120)]
        public string? RecrutadorResponsavel { get; set; }   // vagaRecrutador
        /// <summary>Opcional: vínculo ao usuário recrutador (futuro).</summary>
        public Guid? RecrutadorResponsavelUserId { get; set; }
        public ApplicationUser? RecrutadorResponsavelUser { get; set; }

        public VagaPrioridade? Prioridade { get; set; }      // vagaPrioridade
        public string? ResumoPitch { get; set; }             // vagaResumo

        /// <summary>Texto “;” separado (ex.: "triagem; entrevistas; ...")</summary>
        public string? TagsResponsabilidadesRaw { get; set; } // vagaTagsResponsabilidades
        /// <summary>Texto “;” separado</summary>
        public string? TagsKeywordsRaw { get; set; }          // vagaTagsKeywords

        public bool Confidencial { get; set; }               // vagaConfidencial
        public bool AceitaPcd { get; set; }                  // vagaAceitaPcd
        public bool Urgente { get; set; }                    // vagaUrgente

        // --------------------
        // Inclusão e diversidade
        // --------------------
        public VagaGeneroPreferencia? GeneroPreferencia { get; set; } // vagaGeneroPreferencia
        public bool VagaAfirmativa { get; set; }                      // vagaVagaAfirmativa
        public bool LinguagemInclusiva { get; set; }                  // vagaLinguagemInclusiva

        [StringLength(120)]
        public string? PublicoAfirmativo { get; set; }                // vagaPublicoAfirmativo
        public string? ObservacoesPcd { get; set; }                   // vagaPcdObs

        // --------------------
        // Projeto
        // --------------------
        [StringLength(160)]
        public string? ProjetoNome { get; set; }           // vagaProjetoNome
        [StringLength(160)]
        public string? ProjetoClienteAreaImpactada { get; set; } // vagaProjetoCliente
        [StringLength(80)]
        public string? ProjetoPrazoPrevisto { get; set; }  // vagaProjetoPrazo
        public string? ProjetoDescricao { get; set; }      // vagaProjetoDescricao

        // --------------------
        // Local e jornada
        // --------------------
        public VagaRegimeJornada? Regime { get; set; }     // vagaRegime
        public int? CargaSemanalHoras { get; set; }        // vagaCargaSemanal
        public VagaEscalaTrabalho? Escala { get; set; }    // vagaEscala
        public string? EscalaTrabalhoRaw { get; set; }     // JSON from HorarioEditor (escala + grid)

        public TimeOnly? HoraEntrada { get; set; }         // vagaHoraEntrada (08:00)
        public TimeOnly? HoraSaida { get; set; }           // vagaHoraSaida (17:00)
        public TimeSpan? Intervalo { get; set; }           // vagaIntervalo (01:00)

        [StringLength(10)]
        public string? Cep { get; set; }                   // vagaCep
        [StringLength(160)]
        public string? Logradouro { get; set; }            // vagaLogradouro
        [StringLength(20)]
        public string? Numero { get; set; }                // vagaNumero
        [StringLength(120)]
        public string? Bairro { get; set; }                // vagaBairro
        [StringLength(120)]
        public string? Cidade { get; set; }                // vagaCidade
        [StringLength(2)]
        public string? Uf { get; set; }                    // vagaUF

        [StringLength(200)]
        public string? PoliticaTrabalho { get; set; }      // vagaPoliticaTrabalho
        [StringLength(200)]
        public string? ObservacoesDeslocamento { get; set; } // vagaDeslocamentoObs

        // --------------------
        // Remuneração
        // --------------------
        public VagaMoeda? Moeda { get; set; }              // vagaMoeda
        public decimal? SalarioMinimo { get; set; }        // vagaSalarioMin
        public decimal? SalarioMaximo { get; set; }        // vagaSalarioMax
        public VagaRemuneracaoPeriodicidade? Periodicidade { get; set; } // vagaPeriodicidade

        public VagaBonusTipo? BonusTipo { get; set; }      // vagaBonusTipo
        public decimal? BonusPercentual { get; set; }      // vagaBonusPercentual (0..100)

        [StringLength(240)]
        public string? ObservacoesRemuneracao { get; set; } // vagaRemObs

        // --------------------
        // Alçada salarial — épico Fase 3C
        // --------------------
        /// <summary>
        /// Quando true, a vaga não pode ser salva com salário fora da <see cref="FaixaSalarial"/> do JobPosition,
        /// a menos que um approver autorize a alçada (preenche <see cref="AlcadaSalarialAprovadaPorUserId"/>).
        /// </summary>
        public bool TravarFaixaSalarial { get; set; } = true;

        /// <summary>Id do usuário que aprovou a alçada salarial desta vaga (null = sem aprovação).</summary>
        public Guid? AlcadaSalarialAprovadaPorUserId { get; set; }

        /// <summary>Data/hora UTC da aprovação da alçada.</summary>
        public DateTimeOffset? AlcadaSalarialAprovadaEmUtc { get; set; }

        /// <summary>Justificativa do solicitante para a alçada salarial.</summary>
        [StringLength(1000)]
        public string? AlcadaSalarialJustificativa { get; set; }

        /// <summary>Observação do approver ao conceder a alçada.</summary>
        [StringLength(500)]
        public string? AlcadaSalarialObservacaoAprovador { get; set; }

        // --------------------
        // Qualificações / requisitos
        // --------------------
        public VagaEscolaridade? Escolaridade { get; set; } // vagaEscolaridade
        public VagaFormacaoArea? FormacaoArea { get; set; } // vagaFormacaoArea
        public int? ExperienciaMinimaAnos { get; set; }      // vagaExpMinAnos

        public string? TagsStackRaw { get; set; }           // vagaTagsStack (“;”)
        public string? TagsIdiomasRaw { get; set; }         // vagaTagsIdiomas (“;”)

        public string? Diferenciais { get; set; }           // vagaDiferenciais

        // --------------------
        // Processo seletivo
        // --------------------
        public string? ObservacoesProcesso { get; set; }    // vagaObsProcesso

        // --------------------
        // Publicação e SLA
        // --------------------
        public VagaPublicacaoVisibilidade? Visibilidade { get; set; } // vagaVisibilidade
        public DateOnly? DataInicio { get; set; }           // vagaDataInicio
        public DateOnly? DataEncerramento { get; set; }     // vagaDataFim
        /// <summary>Data/hora em que a vaga passou a status Aberta (início da contagem do SLA).</summary>
        public DateTimeOffset? DataAbertura { get; set; }
        /// <summary>Meta em dias para fechar a vaga (se null, usa config global SlaVaga:DiasMetaFechamento).</summary>
        public int? SlaDiasMetaFechamento { get; set; }

        public bool CanalLinkedIn { get; set; }             // vagaCanalLinkedin
        public bool CanalSiteCarreiras { get; set; }        // vagaCanalSite
        public bool CanalIndicacao { get; set; }            // vagaCanalIndicacao
        public bool CanalPortaisEmprego { get; set; }       // vagaCanalPortal

        public string? DescricaoPublica { get; set; }       // vagaDescricaoPublica

        // --------------------
        // LGPD / Consentimentos
        // --------------------
        public bool LgpdSolicitarConsentimentoExplicito { get; set; } // vagaLgpdConsentimento
        public bool LgpdCompartilharCurriculoInternamente { get; set; } // vagaLgpdCompartilhamento
        public bool LgpdRetencaoAtiva { get; set; }         // vagaLgpdRetencao
        public int? LgpdRetencaoMeses { get; set; }         // vagaLgpdRetencaoMeses

        // --------------------
        // Documentos / Exigências
        // --------------------
        public bool ExigeCnh { get; set; }                   // vagaDocCnh
        public bool DisponibilidadeParaViagens { get; set; } // vagaDocViagens
        public bool ChecagemAntecedentes { get; set; }       // vagaDocAntecedentes

        // --------------------
        // Filhas (listas dinâmicas)
        // --------------------
        public List<VagaBeneficio> Beneficios { get; set; } = new();
        public List<VagaRequisito> Requisitos { get; set; } = new();
        public List<VagaEtapa> Etapas { get; set; } = new();
        public List<VagaPergunta> PerguntasTriagem { get; set; } = new();

        public DateTimeOffset CreatedAtUtc { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }

        // ── Detecção de zumbis (Frente C — sync RM) ──
        // Vaga com Codigo (sync RM) que não vem no payload do worker por N ciclos consecutivos vira zumbi.
        // Não muda Status automaticamente (diretriz "corrigir na origem RM"); apenas dispara RmSyncAlerta.

        /// <summary>Quantos ciclos consecutivos a vaga não foi observada no payload do worker. Reseta a 0 quando reaparece.</summary>
        public int CiclosAusenteRm { get; set; }

        /// <summary>Timestamp do último ciclo do worker em que esta vaga apareceu no payload — null = nunca observada via sync.</summary>
        public DateTimeOffset? UltimoCicloRmObservadoUtc { get; set; }
    }

    // --------------------
    // Benefícios (tpl-vaga-benefit-row)
    // --------------------
    public sealed class VagaBeneficio : ITenantEntity
    {
        public Guid Id { get; set; }
        public string TenantId { get; set; } = default!;
        public Guid VagaId { get; set; }
        public Vaga? Vaga { get; set; }

        public int Ordem { get; set; } = 0; // para manter ordenação do UI

        public VagaBeneficioTipo Tipo { get; set; }         // benefit-type
        public decimal? Valor { get; set; }                 // benefit-value (opcional)
        public VagaBeneficioRecorrencia Recorrencia { get; set; } // benefit-rec
        public bool Obrigatorio { get; set; }               // benefit-required

        [StringLength(240)]
        public string? Observacoes { get; set; }            // benefit-obs
        public DateTimeOffset CreatedAtUtc { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }
    }

    // --------------------
    // Requisitos detalhados (tpl-vaga-modal-req-row)
    // --------------------
    public sealed class VagaRequisito : ITenantEntity
    {
        public Guid Id { get; set; }
        public string TenantId { get; set; } = default!;
        public Guid VagaId { get; set; }
        public Vaga? Vaga { get; set; }

        public int Ordem { get; set; } = 0;

        [Required, StringLength(180)]
        public string Nome { get; set; } = string.Empty;    // req-name

        [StringLength(80)]
        public string? Categoria { get; set; }              // req-category

        public VagaPeso Peso { get; set; }                  // req-weight (1..5)
        public bool Obrigatorio { get; set; }               // req-required

        public int? AnosMinimos { get; set; }               // req-years

        public VagaRequisitoNivel? Nivel { get; set; }      // req-level
        public VagaRequisitoAvaliacao? Avaliacao { get; set; } // req-eval

        [StringLength(400)]
        public string? SinonimosRaw { get; set; }           // req-synonyms

        [StringLength(240)]
        public string? Observacoes { get; set; }            // req-obs

        /// <summary>Link opcional para a taxonomia de skills.</summary>
        public Guid? SkillId { get; set; }
        public Skill? Skill { get; set; }

        public DateTimeOffset CreatedAtUtc { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }
    }

    // --------------------
    // Etapas do processo (tpl-vaga-stage-row)
    // --------------------
    public sealed class VagaEtapa : ITenantEntity
    {
        public Guid Id { get; set; }
        public string TenantId { get; set; } = default!;
        public Guid VagaId { get; set; }
        public Vaga? Vaga { get; set; }

        public int Ordem { get; set; } = 0;

        [Required, StringLength(160)]
        public string Nome { get; set; } = string.Empty;    // stage-name

        public VagaEtapaResponsavel Responsavel { get; set; } // stage-owner
        public VagaEtapaModo Modo { get; set; }             // stage-mode

        public int? SlaDias { get; set; }                   // stage-sla

        [StringLength(240)]
        public string? DescricaoInstrucoes { get; set; }    // stage-desc
        public DateTimeOffset CreatedAtUtc { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }
    }

    // --------------------
    // Perguntas de triagem (tpl-vaga-question-row)
    // --------------------
    public sealed class VagaPergunta : ITenantEntity
    {
        public Guid Id { get; set; }
        public string TenantId { get; set; } = default!;
        public Guid VagaId { get; set; }
        public Vaga? Vaga { get; set; }

        public int Ordem { get; set; } = 0;

        [Required, StringLength(220)]
        public string Texto { get; set; } = string.Empty;   // question-text

        public VagaPerguntaTipo Tipo { get; set; }          // question-type
        public VagaPeso Peso { get; set; }                  // question-weight

        public bool Obrigatoria { get; set; }               // question-required
        public bool Knockout { get; set; }                  // question-ko

        /// <summary>Para tipos com opções: string “;” separada (ex.: "Sim;Não;Talvez").</summary>
        public string? OpcoesRaw { get; set; }              // question-options

        public DateTimeOffset CreatedAtUtc { get; set; }
        public DateTimeOffset UpdatedAtUtc { get; set; }
    }
}
