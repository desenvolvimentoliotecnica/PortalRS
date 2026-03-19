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

        public Guid? DepartmentId { get; set; }         // vagaDepartmentId (opcional)
        public Department? Department { get; set; }     // navigation

        public VagaAreaTime? AreaTime { get; set; }         // vagaAreaTime

        // ✅ agora vem de tabela (Areas), não enum
        [Required]
        public Guid AreaId { get; set; }                    // vagaAreaId *
        public Area? Area { get; set; }                     // navigation

        public VagaModalidade? Modalidade { get; set; }     // vagaModalidade
        public VagaStatus Status { get; set; }              // vagaStatus *
        public VagaSenioridade? Senioridade { get; set; }   // vagaSenioridade

        public int QuantidadeVagas { get; set; } = 1;        // vagaQuantidade
        public VagaTipoContratacao? TipoContratacao { get; set; } // vagaTipoContratacao

        /// <summary>Match mínimo em % (0..100). Ex.: 70</summary>
        public int MatchMinimoPercentual { get; set; } = 70; // vagaThreshold

        // Pesos por categoria (soma ideal = 100)
        public int PesoCompetencia { get; set; } = 40;
        public int PesoExperiencia { get; set; } = 30;
        public int PesoFormacao { get; set; } = 15;
        public int PesoLocalidade { get; set; } = 15;

        /// <summary>Regras/filtros atuais de matching (prompt/contexto para IA).</summary>
        public string? MatchingFiltrosRaw { get; set; }
        /// <summary>Cópia dos filtros na criação da vaga; usado para "Reverter para filtros da criação".</summary>
        public string? MatchingFiltrosOriginaisRaw { get; set; }

        public string? DescricaoInterna { get; set; }        // vagaDescricao

        [StringLength(40)]
        public string? CodigoInterno { get; set; }           // vagaCodigoInterno
        [StringLength(20)]
        public string? CodigoCbo { get; set; }               // vagaCbo

        public VagaMotivoAbertura? MotivoAbertura { get; set; }   // vagaMotivoAbertura
        public VagaOrcamentoAprovado? OrcamentoAprovado { get; set; } // vagaOrcamento

        [StringLength(120)]
        public string? GestorRequisitante { get; set; }      // vagaGestor
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
