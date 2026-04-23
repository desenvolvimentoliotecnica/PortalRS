#!/usr/bin/env python3
"""
Mock TOTVS Admissão — fluxo full via API QA.

Cria pré-admissão com CPF aleatório, preenche via PUT com o payload do
mock LUIZ FERNANDO SOARES (validado pelo Datasul QA), chama submit e
espera o worker processar. Serve como teste ponta-a-ponta depois de
cada deploy de QA.

Payload em ISO (datas yyyy-MM-dd) e gramas (peso) — exige API v2.6+
(migration AlterCnhDatesParaDateOnlyEPesoParaGramas aplicada).

Uso:
    python qa-mock-fullflow-admissao.py

Sobrescrevendo defaults:
    QA_BASE_URL=... QA_EMAIL=... QA_PASSWORD=... QA_TENANT=... python qa-mock-fullflow-admissao.py
"""
import json
import os
import random
import sys
import time
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError

# ── Config ──────────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("QA_BASE_URL", "https://renderrh-qa.qualiit.com.br")
EMAIL    = os.environ.get("QA_EMAIL",    "admin@dev.local")
PASSWORD = os.environ.get("QA_PASSWORD", "ChangeThisPassword123!")
TENANT   = os.environ.get("QA_TENANT",   "consigaz")

# ── Helpers ─────────────────────────────────────────────────────────────────
def http(method: str, path: str, body: Any = None, token: str | None = None) -> dict:
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "X-Tenant-Id": TENANT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urlrequest.Request(url, data=data, headers=headers, method=method)
    try:
        with urlrequest.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        err = e.read().decode()
        print(f"\n❌ {method} {path} → HTTP {e.code}")
        print(err[:2000])
        sys.exit(1)

def gerar_cpf() -> str:
    """CPF válido aleatório (só dígitos)."""
    base = [random.randint(0, 9) for _ in range(9)]
    for _ in range(2):
        s = sum((len(base) + 1 - i) * d for i, d in enumerate(base))
        dv = (s * 10) % 11
        base.append(0 if dv == 10 else dv)
    return "".join(str(d) for d in base)

# ── Payload espelho do mock LUIZ FERNANDO SOARES que integra no Datasul ─────
def build_payload(nome: str, cpf: str) -> dict:
    return {
        # Pessoal
        "nome": nome, "nomeSocial": None, "nomeAbreviado": nome.split()[0],
        "cpf": cpf,
        "rg": "353673791", "rgOrgaoExpedidor": "SSP", "rgUfExpedidor": "SP",
        "rgDataExpedicao": "2010-10-27",
        "dataNascimento": "1982-05-31",
        "sexo": "Masculino", "estadoCivil": "Solteiro",
        "nacionalidade": "Brasileira", "paisNacionalidade": "BRA",
        "nomeMae": "Aurelia Mercado", "nomePai": "Roberto Soares",
        "naturalCidade": "SAO PAULO", "naturalUf": "SP", "paisNascimento": "BRA",
        # Estrangeiro
        "passaporte": None, "rnmRne": None, "validadeVisto": None, "tipoVisto": None,
        "resideExterior": "N", "tipoVistoEstrangeiro": 1,
        # RIC
        "regIdentidCivilNumero": "353673791", "regIdentidCivilUf": "SP",
        "regIdentidCivilCidade": "SAO PAULO", "regIdentidCivilOrgEmiss": "SSP",
        "regIdentidCivilDataExped": "2010-10-27",
        # Endereço
        "cep": "04562000", "logradouro": "Rua Indiana",
        "numero": "71", "complemento": None, "bairro": "Brooklin",
        "cidade": "Sao Paulo", "uf": "SP",
        "pontoReferencia": "Teste",
        "tipoLogradouroESocial": "R", "municipioEnderecoIbge": 3550308,
        # Contato
        "email": f"luiz.qa.{cpf[-6:]}@qualiit-test.com.br",
        "emailAlternativo": f"teste.qa.{cpf[-6:]}@qualiit-test.com.br",
        "telefone": "38341345", "celular": "988224045",
        "dddTelefone": 11, "dddTelContato": 11,
        "contatoEmergenciaNome": "Aurelia Mercado",
        "contatoEmergenciaFone": "11988224045",
        # Bancário (TipoConta enum: "ContaCorrente" = 0 / "ContaPoupanca" = 1 / "ContaSalario" = 2)
        "bancoCodigo": "033", "bancoNome": "Santander",
        "agencia": "4196", "agenciaDigito": "0",
        "conta": "1079060", "contaDigito": "5",
        "tipoConta": "ContaCorrente",
        # Trabalhista
        "estabelecimentoCodigo": "099", "codEmpresa": "1",
        "unitId": None, "areaId": None, "jobPositionId": None, "requisitoCategoriaId": None,
        "dataAdmissao": "2016-05-16", "salario": 3835.00,
        "tipoContratacao": "CLT", "cargaHorariaSemanal": 44,
        "pisPasep": "38752119521",
        # TOTVS
        "codCargoTotvs": 299, "codVinculoEmpregaticio": 10,
        "tipoFuncionario": 1, "categoriaSalarial": 1, "grauInstrucao": 9,
        "codTurno": 1,
        "centroCusto": "99999", "unidadeLotacao": "00001001",
        "codPlanoLotacao": 101, "codTurma": 1,
        "numCartaoPonto": 28101049, "codNivel": 0,
        "tipoMaoDeObra": "ADM", "formaPagamento": 1,
        "salarioSimulado": 9918.20,
        "origemFuncionario": 1, "indFuncVinculado": 1, "funcQualificado": "S",
        # FGTS/INSS
        "optanteFgts": "S", "dataOpcaoFgts": "2018-11-17",
        "tipoAdmissaoFgts": 1, "recolheFgts": "S", "recolheInss": "S",
        # Sindicato
        "sindicalizado": "N", "descContribSindical": "N",
        "contribSindicDia": "S", "codSindicato": 1,
        # Flags cálculo
        "cargaAutomTurno": "S", "recebePericul": "N", "recebeInsalub": "N",
        "recebeAdiantamento": "S", "considEmissRAIS": "S",
        "calcula13": "S", "recebeFerias": "S",
        # Provisões 13 (funcionário migrado — valores históricos)
        "avos13SalCalcAnterior": 5, "avos13SalCalc": 6,
        "provAcum13Sal": 2093.14, "provAcumInss13Sal": 555.72, "provAcumFgts13Sal": 167.45,
        # Provisões Férias
        "diasProvFeriasMesAnterior": 475, "diasProvFeriasMesAtual": 500,
        "provAcumFerias": 6661.47, "provAcumInssFerias": 2358.16,
        "provAcumFgtsFerias": 710.55, "provAcumFerias13": 2220.49,
        # Ponto
        "emitCartPonto": "1",
        "codLocalMarcacao": 1, "codClassFuncPontoEletronico": 1,
        # Docs avulsos
        "tituloEleitorNumero": "96215860116",
        "tituloEleitorZona": "258", "tituloEleitorSecao": "190",
        "tituloEleitorCidade": "SAO PAULO", "tituloEleitorUf": "SP",
        "reservistaNumero": None,
        "categoriaCnh": "B", "validadeCnh": "2021-05-25",
        "ctps": "30599", "ctpsSerie": "272", "ctpsUf": "SP",
        "ctpsModelo": 3, "ctpsSerieESocial": "272",
        "cnhNumero": "5555685014", "cnhUf": "SP", "cnhOrgaoEmissor": "SSP",
        "cnhDataExpedicao": "2018-10-25", "cnhPrimeiraHabilitacao": "2002-06-14",
        # Doc Militar
        "docMilitarTipo": 1, "docMilitarNumero": "399855", "docMilitarSerie": "A",
        # DocMilitarCircunscricao: mock TOTVS do Luiz diz 0, mas validator (ReqInt)
        # trata 0 como "não preenchido" — enviamos 1 pra passar na validação.
        "docMilitarRegiao": 2, "docMilitarCircunscricao": 1,
        # Saúde
        "grupoSanguineo": 1, "fatorRh": 2,
        "possuiDeficiencia": "N", "funcDoador": "S",
        "cartaoSus": "10000141200",
        "altura": 180, "peso": 900,
        "cutis": 3, "cabelo": 1, "olhos": 1,
        "manequim": 40, "sapato": 42,
        # Contrato (dataTerminoContrato continua legado int DDMMAAAA, não migrou pra DateOnly)
        "dataTerminoContrato": 30082021,
        # Localidade
        "paisLocalidade": "BRA", "codLocalidade": 17, "codFpas": None,
        # eSocial
        "categoriaTrabalhoESocial": 101,
        "indAdmissao": 1, "naturezaAtividade": 1,
        "municipioNascimentoIbge": 3550308,
        "tipoAdmissaoESocial": 1,
        "regimeTrabalhista": 1, "regimePrevidenciario": 1, "regimeJornada": 1,
        "matriculaESocial": None,
        # Estatística + CAGED (TOTVS exige >= 1)
        "tipoEstatistica": 1, "ocorrenciaCAGED": 1,
        "codRegistroExterior": None,
        "validacaoSalarioJustificativa": "QA mock — salário validado pelo gestor.",
    }

# ── Fluxo ───────────────────────────────────────────────────────────────────
def main():
    print(f"🔐 Login: {EMAIL} @ {TENANT}")
    login = http("POST", "/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    token = login.get("accessToken") or login.get("token")
    if not token:
        print(f"❌ Sem token na resposta: {login}")
        sys.exit(1)
    print(f"✅ Login OK")

    cpf = gerar_cpf()
    nome = f"Luiz QA {cpf[-4:]}"
    print(f"\n📝 Criando pré-admissão: {nome} / CPF {cpf}")
    created = http("POST", "/api/pre-admissao",
                   {"preenchidoPor": "RH", "candidatoId": None, "nome": nome, "cpf": cpf},
                   token=token)
    pre_id = created["id"]
    print(f"✅ Criada: {pre_id}")

    print(f"\n✏️  PUT com payload completo")
    payload = build_payload(nome, cpf)
    http("PUT", f"/api/pre-admissao/{pre_id}", payload, token=token)
    print(f"✅ Atualizada")

    print(f"\n🚀 Submit (auto-aprova se validator passar)")
    submitted = http("POST", f"/api/pre-admissao/{pre_id}/submit", token=token)
    status = submitted.get("status")
    print(f"✅ Status = {status}")

    if status != "Aprovada":
        print(f"\n⚠️  Não foi auto-aprovada. Dados: {json.dumps(submitted, indent=2)[:1500]}")
        sys.exit(2)

    print(f"\n⏳ Aguardando integração TOTVS (worker roda a cada ~10s)…")
    for i in range(12):
        time.sleep(10)
        detail = http("GET", f"/api/pre-admissao/{pre_id}", token=token)
        resultado = detail.get("integracaoResultado")
        msg = detail.get("integracaoMensagem") or ""
        print(f"  [{i+1:2d}/12] resultado={resultado!r:<10}  msg={msg[:100]}")
        if resultado in ("Sucesso", "FalhaDefinitiva"):
            break
        if resultado == "Falha" and msg:
            print(f"\n❌ Datasul rejeitou: {msg}")
            break

    detail = http("GET", f"/api/pre-admissao/{pre_id}", token=token)
    print(f"\n📊 Resultado final:")
    print(f"   status              = {detail.get('status')}")
    print(f"   integracaoResultado = {detail.get('integracaoResultado')}")
    print(f"   integracaoMensagem  = {detail.get('integracaoMensagem')}")
    print(f"   matriculaRM         = {detail.get('matriculaRM')}")
    print(f"\n🆔 PreAdmissao ID: {pre_id}")

if __name__ == "__main__":
    main()
