# Dados fictícios para testar o Matching

Use estes dados na interface (Vagas e Candidatos) para criar **2 vagas** e **4 candidatos** e testar o matching.

---

## 1. Vaga A – Desenvolvedor .NET Pleno

Na tela **Vagas**, crie a primeira vaga:

| Campo | Valor |
|-------|--------|
| **Título** | Desenvolvedor .NET Pleno |
| **Código** | DEV-NET-2025-01 |
| **Status** | Aberta |
| **Área** | (escolha uma área existente, ex.: TI) |
| **Departamento** | (escolha um departamento existente) |
| **Modalidade** | Híbrido |
| **Senioridade** | Pleno |
| **Quantidade de vagas** | 1 |
| **Match mínimo %** | 70 |

### Aba "Filtros de matching (IA)" – Vaga A

| Campo | Valor |
|-------|--------|
| **Modalidade** | Híbrido |
| **Senioridade** | Pleno |
| **Escolaridade** | Superior completo |
| **Formação (área)** | Ciência da computação ou TI |
| **Cidade** | São Paulo |
| **UF** | SP |
| **Tempo de experiência** | 3 a 5 anos |
| **Habilidades desejadas** | .NET, C#, SQL Server, APIs REST, Entity Framework |
| **Observações** | Conhecimento em testes automatizados e Git. |

---

## 2. Vaga B – Analista de Marketing Digital

Crie a segunda vaga (diferente da primeira):

| Campo | Valor |
|-------|--------|
| **Título** | Analista de Marketing Digital |
| **Código** | MKT-DIG-2025-01 |
| **Status** | Aberta |
| **Área** | (ex.: Marketing ou Comercial) |
| **Departamento** | (escolha um departamento existente) |
| **Modalidade** | Remoto |
| **Senioridade** | Júnior |
| **Quantidade de vagas** | 1 |
| **Match mínimo %** | 60 |

### Aba "Filtros de matching (IA)" – Vaga B

| Campo | Valor |
|-------|--------|
| **Modalidade** | Remoto |
| **Senioridade** | Júnior |
| **Escolaridade** | Superior completo ou cursando |
| **Formação (área)** | Marketing, Publicidade ou Comunicação |
| **Cidade** | (deixe em branco ou Qualquer) |
| **UF** | (Qualquer) |
| **Tempo de experiência** | 0 a 1 ano |
| **Habilidades desejadas** | Google Ads, Meta Ads, SEO, redes sociais, Google Analytics |
| **Observações** | Noções de copy e métricas de conversão. |

---

## 3. Candidato 1 – Marina Costa Lima (perfil .NET)

| Campo | Valor |
|-------|--------|
| **Nome** | Marina Costa Lima |
| **Email** | marina.costa.lima@email.com |
| **Telefone** | (11) 98765-4321 |
| **Cidade** | São Paulo |
| **UF** | SP |
| **Fonte** | LinkedIn |
| **Status** | Novo |
| **Vaga** | Desenvolvedor .NET Pleno (DEV-NET-2025-01) |

**Texto do currículo (CvText):**

```
Desenvolvedora .NET com 4 anos de experiência. Formação em Ciência da Computação.
Atuação com C#, ASP.NET Core, Entity Framework, SQL Server e APIs REST.
Conhecimento em Git, testes unitários (xUnit) e Azure DevOps.
Experiência em trabalho híbrido.
```

---

## 4. Candidato 2 – Ricardo Alves Pereira (perfil .NET em transição)

| Campo | Valor |
|-------|--------|
| **Nome** | Ricardo Alves Pereira |
| **Email** | ricardo.alves@email.com |
| **Telefone** | (11) 97654-3210 |
| **Cidade** | Guarulhos |
| **UF** | SP |
| **Fonte** | Indicacao |
| **Status** | Novo |
| **Vaga** | Desenvolvedor .NET Pleno (DEV-NET-2025-01) |

**Texto do currículo (CvText):**

```
Analista de sistemas em transição para desenvolvimento. 2 anos com .NET e C#.
Graduação em Sistemas de Informação. Conhecimento em SQL, APIs REST e Entity Framework.
Estudando testes automatizados. Disponibilidade para híbrido na região de SP.
```

---

## 5. Candidato 3 – Fernanda Oliveira Santos (perfil Marketing)

| Campo | Valor |
|-------|--------|
| **Nome** | Fernanda Oliveira Santos |
| **Email** | fernanda.oliveira.santos@email.com |
| **Telefone** | (21) 99887-6655 |
| **Cidade** | Rio de Janeiro |
| **UF** | RJ |
| **Fonte** | Site |
| **Status** | Novo |
| **Vaga** | Analista de Marketing Digital (MKT-DIG-2025-01) |

**Texto do currículo (CvText):**

```
Graduada em Publicidade e Propaganda. 1 ano de experiência em marketing digital.
Gestão de campanhas no Google Ads e Meta Ads, relatórios no Google Analytics.
Conhecimento em SEO e produção de conteúdo para redes sociais.
Busco oportunidade remota.
```

---

## 6. Candidato 4 – Bruno Mendes Rocha (perfil Marketing iniciante)

| Campo | Valor |
|-------|--------|
| **Nome** | Bruno Mendes Rocha |
| **Email** | bruno.mendes.rocha@email.com |
| **Telefone** | (31) 99123-4567 |
| **Cidade** | Belo Horizonte |
| **UF** | MG |
| **Fonte** | LinkedIn |
| **Status** | Novo |
| **Vaga** | Analista de Marketing Digital (MKT-DIG-2025-01) |

**Texto do currículo (CvText):**

```
Cursando Marketing (6º período). Estágio de 6 meses em agência com foco em redes sociais.
Noções de Facebook Ads e Instagram. Interesse em SEO e Google Analytics.
Disponível para atuar 100% remoto.
```

---

## Ordem sugerida para testar

1. Criar as **2 vagas** (DEV-NET-2025-01 e MKT-DIG-2025-01), cada uma com seus filtros de matching.
2. Criar os **4 candidatos**: 2 vinculados à vaga .NET (Marina e Ricardo) e 2 à vaga Marketing (Fernanda e Bruno), com os currículos acima.
3. Em **Matching**, selecionar primeiro a vaga **Desenvolvedor .NET Pleno**: Marina tende a pontuar mais que Ricardo.
4. Depois selecionar a vaga **Analista de Marketing Digital**: Fernanda tende a pontuar mais que Bruno.

Assim você testa ranking em duas vagas diferentes e compara scores entre candidatos do mesmo perfil.
