-- ══════════════════════════════════════════════════════════════
-- SEED: Pré-admissões mock para teste de integração TOTVS
-- Tenant: liotecnica
-- Status 3 = Aprovada → ficam na fila de GET /api/pre-admissao/integracao/pendentes
-- ══════════════════════════════════════════════════════════════

-- Limpa mock anterior (safe para re-executar)
DELETE FROM "PreAdmissoes"
WHERE "TenantId" = 'liotecnica'
  AND "Id" IN (
    'adm00001-0000-4000-a000-000000000001',
    'adm00001-0000-4000-a000-000000000002',
    'adm00001-0000-4000-a000-000000000003'
  );

-- ── Admissão 1: CLT, dados completos ──────────────────────────
INSERT INTO "PreAdmissoes" (
  "Id", "TenantId", "Status", "PreenchidoPor",
  "Nome", "Cpf", "Rg", "RgOrgaoExpedidor", "RgDataExpedicao",
  "DataNascimento", "Sexo", "EstadoCivil", "Nacionalidade",
  "NomeMae", "NomePai", "NaturalCidade", "NaturalUf",
  "Cep", "Logradouro", "Numero", "Bairro", "Cidade", "Uf",
  "Email", "Telefone", "Celular",
  "ContatoEmergenciaNome", "ContatoEmergenciaFone",
  "BancoCodigo", "BancoNome", "Agencia", "Conta", "ContaDigito", "TipoConta",
  "DataAdmissao", "Salario", "TipoContratacao", "CargaHorariaSemanal",
  "PisPasep", "Ctps", "CtpsSerie", "CtpsUf",
  "ValidacaoCpfOk", "ValidacaoCepOk", "ValidacaoBancoOk", "ValidacaoSalarioOk",
  "CreatedAtUtc", "UpdatedAtUtc", "SubmittedAtUtc", "ApprovedAtUtc"
) VALUES (
  'adm00001-0000-4000-a000-000000000001', 'liotecnica', 3, 1,
  'Ana Clara Silva', '111.222.333-44', '12.345.678-9', 'SSP/SP', '2015-03-10',
  '1990-07-22', 2, 2, 'Brasileira',
  'Maria da Silva', 'José da Silva', 'São Paulo', 'SP',
  '01310-100', 'Avenida Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP',
  'ana.clara.silva@testmail.com', '(11) 3344-5566', '(11) 99901-1001',
  'Carlos Silva', '(11) 98800-0001',
  '033', 'Santander', '0001', '12345678', '9', 0,
  '2026-04-01', 9500.00, 0, 44,
  '123.45678.12-3', '000123', '001', 'SP',
  true, true, true, true,
  NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'
);

-- ── Admissão 2: CLT, dados parciais (cenário comum) ───────────
INSERT INTO "PreAdmissoes" (
  "Id", "TenantId", "Status", "PreenchidoPor",
  "Nome", "Cpf", "Rg", "RgOrgaoExpedidor",
  "DataNascimento", "Sexo", "EstadoCivil", "Nacionalidade",
  "NomeMae", "NaturalCidade", "NaturalUf",
  "Cep", "Logradouro", "Numero", "Bairro", "Cidade", "Uf",
  "Email", "Celular",
  "ContatoEmergenciaNome", "ContatoEmergenciaFone",
  "BancoCodigo", "BancoNome", "Agencia", "Conta", "ContaDigito", "TipoConta",
  "DataAdmissao", "Salario", "TipoContratacao", "CargaHorariaSemanal",
  "PisPasep", "Ctps", "CtpsSerie", "CtpsUf",
  "ValidacaoCpfOk", "ValidacaoCepOk", "ValidacaoBancoOk", "ValidacaoSalarioOk",
  "CreatedAtUtc", "UpdatedAtUtc", "SubmittedAtUtc", "ApprovedAtUtc"
) VALUES (
  'adm00001-0000-4000-a000-000000000002', 'liotecnica', 3, 0,
  'Bruno Henrique Costa', '222.333.444-55', '23.456.789-0', 'SSP/SP',
  '1988-11-05', 1, 1, 'Brasileira',
  'Rosana Costa', 'Campinas', 'SP',
  '13010-110', 'Rua Barão de Jaguara', '500', 'Centro', 'Campinas', 'SP',
  'bruno.costa@testmail.com', '(19) 99802-2002',
  'Patricia Costa', '(19) 98700-0002',
  '001', 'Banco do Brasil', '1234', '87654321', '0', 0,
  '2026-04-01', 7200.00, 0, 44,
  '234.56789.23-4', '000456', '002', 'SP',
  true, true, true, true,
  NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'
);

-- ── Admissão 3: Estágio ────────────────────────────────────────
INSERT INTO "PreAdmissoes" (
  "Id", "TenantId", "Status", "PreenchidoPor",
  "Nome", "Cpf", "Rg", "RgOrgaoExpedidor",
  "DataNascimento", "Sexo", "EstadoCivil", "Nacionalidade",
  "NomeMae", "NaturalCidade", "NaturalUf",
  "Cep", "Logradouro", "Numero", "Bairro", "Cidade", "Uf",
  "Email", "Celular",
  "DataAdmissao", "Salario", "TipoContratacao", "CargaHorariaSemanal",
  "ValidacaoCpfOk", "ValidacaoCepOk", "ValidacaoBancoOk", "ValidacaoSalarioOk",
  "CreatedAtUtc", "UpdatedAtUtc", "SubmittedAtUtc", "ApprovedAtUtc"
) VALUES (
  'adm00001-0000-4000-a000-000000000003', 'liotecnica', 3, 1,
  'Carla Mendes Ferreira', '333.444.555-66', '34.567.890-1', 'SSP/SP',
  '2002-04-14', 2, 1, 'Brasileira',
  'Simone Ferreira', 'São Paulo', 'SP',
  '04552-050', 'Rua Funchal', '263', 'Vila Olímpia', 'São Paulo', 'SP',
  'carla.mendes@testmail.com', '(11) 99803-3003',
  '2026-04-07', 2200.00, 2, 30,
  true, true, false, true,
  NOW() - INTERVAL '4 days', NOW(),
  NOW() - INTERVAL '2 days', NOW()
);

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: deve retornar 3 registros
-- SELECT "Id", "Nome", "Status", "DataAdmissao", "Salario", "TipoContratacao"
-- FROM "PreAdmissoes"
-- WHERE "TenantId" = 'liotecnica' AND "Status" = 3
-- ORDER BY "ApprovedAtUtc" DESC;
-- ══════════════════════════════════════════════════════════════
