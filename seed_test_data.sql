-- ══════════════════════════════════════════
-- SEED DATA PARA TESTES - tenant liotecnica
-- ══════════════════════════════════════════

-- VAGA 1: Desenvolvedor Backend Senior
INSERT INTO "Vagas" (
  "Id", "TenantId", "Titulo", "Codigo", "DepartmentId", "AreaId", "Status", "Senioridade",
  "QuantidadeVagas", "MatchMinimoPercentual", "Cidade", "Uf",
  "SalarioMinimo", "SalarioMaximo", "DescricaoInterna", "ResumoPitch",
  "TagsKeywordsRaw", "TagsResponsabilidadesRaw",
  "PesoCompetencia", "PesoExperiencia", "PesoFormacao", "PesoLocalidade",
  "CreatedAtUtc", "UpdatedAtUtc"
) VALUES (
  'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 'liotecnica',
  'Desenvolvedor Backend Senior (.NET)', 'DEV-SR-001',
  '04342b40-5d64-4597-bdd5-f4c35e712a7f',
  'b0f22729-0f9d-4e71-8773-96e26174b327', 2, 4,
  2, 70, 'Sao Paulo', 'SP',
  8000, 15000,
  'Vaga para dev senior com experiencia em .NET 8, APIs REST, SQL Server e Azure. Modelo hibrido 3x2.',
  'Buscamos um dev senior apaixonado por backend, que goste de arquitetar solucoes escalaveis.',
  'dotnet;csharp;sqlserver;api;rest;backend;azure;docker',
  'arquitetura;code-review;mentoria;apis;microsservicos',
  40, 30, 15, 15,
  NOW(), NOW()
);

-- VAGA 2: Analista de Qualidade
INSERT INTO "Vagas" (
  "Id", "TenantId", "Titulo", "Codigo", "DepartmentId", "AreaId", "Status", "Senioridade",
  "QuantidadeVagas", "MatchMinimoPercentual", "Cidade", "Uf",
  "SalarioMinimo", "SalarioMaximo", "DescricaoInterna", "ResumoPitch",
  "TagsKeywordsRaw", "TagsResponsabilidadesRaw",
  "PesoCompetencia", "PesoExperiencia", "PesoFormacao", "PesoLocalidade",
  "CreatedAtUtc", "UpdatedAtUtc"
) VALUES (
  'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa002', 'liotecnica',
  'Analista de Qualidade Pleno', 'QUA-PL-001',
  '04342b40-5d64-4597-bdd5-f4c35e712a7f',
  'e2715231-4b13-4fcf-8578-130b88767924', 2, 3,
  1, 65, 'Embu das Artes', 'SP',
  4500, 7000,
  'Responsavel por auditorias internas, controle de qualidade e conformidade com ISO 9001 e FSSC 22000.',
  'Procuramos um analista de qualidade com vivencia em industria alimenticia.',
  'qualidade;iso9001;fssc22000;auditoria;bpf;appcc',
  'auditorias;controle-qualidade;documentacao;nao-conformidades',
  40, 30, 15, 15,
  NOW(), NOW()
);

-- ══════════════════════════════════════════
-- CANDIDATOS
-- ══════════════════════════════════════════

INSERT INTO "Candidatos" ("Id", "TenantId", "Nome", "Email", "Fone", "Cidade", "Uf", "VagaId", "Fonte", "Status", "ResumoProfissional", "PretensaoSalarial", "TrabalhandoAtualmente", "CvText", "LastMatchScore", "LastMatchPass", "LastMatchAtUtc", "CreatedAtUtc", "UpdatedAtUtc") VALUES
('c0c00001-cccc-4ccc-cccc-cccccccccc01', 'liotecnica', 'Ana Clara Silva', 'ana.silva@testmail.com', '(11) 99901-1001', 'Sao Paulo', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 4, 2, '8 anos como dev backend .NET. Especialista em APIs REST e microsservicos. Tech Lead.', 12000, true, 'Tech Lead na Empresa ABC (C#, .NET 8, SQL Server, Azure). Dev Senior na Startup XYZ. USP.', 92, true, NOW(), NOW() - INTERVAL '15 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc02', 'liotecnica', 'Bruno Costa Almeida', 'bruno.costa@testmail.com', '(11) 99902-2002', 'Sao Paulo', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 2, 2, '6 anos dev backend. Forte em C#, DDD, CQRS e mensageria (Kafka).', 10000, false, 'Backend Developer na FinTech Omega (C#, Kafka, MongoDB). UNICAMP.', 85, true, NOW(), NOW() - INTERVAL '12 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc03', 'liotecnica', 'Carla Mendes Ferreira', 'carla.mendes@testmail.com', '(11) 99903-3003', 'Campinas', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 0, 1, '5 anos Java/Spring, transicao para .NET nos ultimos 2 anos.', 9000, true, 'Dev Backend na TechCo (C#, .NET 7). Dev Java Enterprise Solutions. PUC Campinas.', 78, true, NOW(), NOW() - INTERVAL '8 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc04', 'liotecnica', 'Diego Rocha Santos', 'diego.rocha@testmail.com', '(21) 99904-4004', 'Rio de Janeiro', 'RJ', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 4, 1, '3 anos dev junior/pleno Node.js. Aprendendo .NET Core.', 7000, true, 'Dev Pleno Node.js/TypeScript. Dev Junior JavaScript/React. Estacio.', 55, false, NOW(), NOW() - INTERVAL '5 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc05', 'liotecnica', 'Elena Ribeiro Lima', 'elena.ribeiro@testmail.com', '(11) 99905-5005', 'Sao Paulo', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa001', 3, 2, '10 anos arquiteta de software .NET. Lideranca de equipes. Mestrado USP.', 15000, true, 'Arquiteta na BigCorp (Azure, K8s). Tech Lead MidSize Co. Mestrado USP. AWS+Azure Architect.', 95, true, NOW(), NOW() - INTERVAL '18 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc06', 'liotecnica', 'Fernanda Oliveira Costa', 'fernanda.oliveira@testmail.com', '(11) 99906-6006', 'Embu das Artes', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa002', 4, 1, '4 anos controle de qualidade alimenticia. ISO 9001, FSSC 22000.', 5500, true, 'Analista Qualidade Alimentos Top. Aux. Controle FoodCo. Eng Alimentos UNICAMP.', 80, true, NOW(), NOW() - INTERVAL '6 days', NOW()),
('c0c00001-cccc-4ccc-cccc-cccccccccc07', 'liotecnica', 'Gustavo Henrique Moreira', 'gustavo.moreira@testmail.com', '(11) 99907-7007', 'Sao Paulo', 'SP', 'a0a00001-aaaa-4aaa-aaaa-aaaaaaaaa002', 2, 1, '2 anos qualidade industrial. ISO 9001 e BPF.', 4500, false, 'Tecnico Qualidade IndustriaXYZ. Gestao Qualidade FATEC.', 72, true, NOW(), NOW() - INTERVAL '4 days', NOW());

-- ══════════════════════════════════════════
-- BANCO DE TALENTOS
-- ══════════════════════════════════════════

INSERT INTO "Pessoas" ("Id", "TenantId", "Nome", "Email", "Fone", "Cidade", "Uf", "Cpf", "DataNascimento", "Origem", "CreatedAtUtc", "UpdatedAtUtc") VALUES
('b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb01', 'liotecnica', 'Felipe Augusto Martins', 'felipe.martins@testmail.com', '(31) 99908-8008', 'Belo Horizonte', 'MG', '11122233344', '1988-03-12', 4, NOW(), NOW()),
('b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb02', 'liotecnica', 'Gabriela Souza Nunes', 'gabriela.souza@testmail.com', '(41) 99909-9009', 'Curitiba', 'PR', '55566677788', '1992-07-25', 4, NOW(), NOW()),
('b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb03', 'liotecnica', 'Henrique Alves Barbosa', 'henrique.alves@testmail.com', '(11) 99910-1010', 'Sao Paulo', 'SP', '99988877766', '1985-11-08', 4, NOW(), NOW());

INSERT INTO "Talentos" ("Id", "TenantId", "PessoaId", "Origem", "Versao", "CreatedAtUtc", "UpdatedAtUtc") VALUES
('d0d00001-dddd-4ddd-dddd-dddddddddd01', 'liotecnica', 'b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb01', 4, 1, NOW(), NOW()),
('d0d00001-dddd-4ddd-dddd-dddddddddd02', 'liotecnica', 'b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb02', 4, 1, NOW(), NOW()),
('d0d00001-dddd-4ddd-dddd-dddddddddd03', 'liotecnica', 'b0b00001-bbbb-4bbb-bbbb-bbbbbbbbbb03', 4, 1, NOW(), NOW());

INSERT INTO "TalentoCompetencias" ("Id", "TenantId", "TalentoId", "Tipo", "Nome", "Nivel", "Evidencia", "TempoAtuacao", "CreatedAtUtc", "UpdatedAtUtc") VALUES
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd01', 'Backend', 'C# / .NET', 'Avancado', 'APIs REST e microsservicos', '8 anos', NOW(), NOW()),
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd01', 'DevOps', 'Azure / Docker', 'Intermediario', 'CI/CD pipelines', '4 anos', NOW(), NOW()),
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd02', 'Frontend', 'React / TypeScript', 'Avancado', 'SPA, Next.js', '6 anos', NOW(), NOW()),
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd02', 'Backend', 'Node.js', 'Intermediario', 'Express, NestJS', '3 anos', NOW(), NOW()),
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd03', 'Qualidade', 'ISO 9001 / BPF', 'Avancado', 'Auditor lider', '10 anos', NOW(), NOW()),
(gen_random_uuid(), 'liotecnica', 'd0d00001-dddd-4ddd-dddd-dddddddddd03', 'Qualidade', 'FSSC 22000', 'Avancado', 'Implementacao completa', '7 anos', NOW(), NOW());
