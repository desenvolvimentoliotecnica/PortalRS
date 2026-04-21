#!/usr/bin/env python3
"""
Mock TOTVS Admissão — fluxo full via API QA.

Cria pré-admissão com CPF aleatório, preenche via PUT com o payload do
mock MARIANA (que integra no Datasul), chama submit e espera o worker
processar. Serve como teste ponta-a-ponta depois de cada deploy de QA.

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
EMAIL    = os.environ.get("QA_EMAIL",    "admin@consigaz.com")
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

# ── Payload espelho do mock MARIANA que integrou com sucesso ────────────────
def build_payload(nome: str, cpf: str) -> dict:
    return {
        # Pessoal
        "nome": nome, "nomeSocial": None, "nomeAbreviado": nome.split()[0],
        "cpf": cpf,
        "rg": "478215036", "rgOrgaoExpedidor": "SSP", "rgUfExpedidor": "SP",
        "rgDataExpedicao": "2012-04-18",
        "dataNascimento": "1994-07-22",
        "sexo": "Feminino", "estadoCivil": "Solteiro",
        "nacionalidade": "Brasileira", "paisNacionalidade": "BRA",
        "nomeMae": "Sandra Regina Oliveira", "nomePai": "Carlos Eduardo Costa",
        "naturalCidade": "CAMPINAS", "naturalUf": "SP", "paisNascimento": "BRA",
        # Estrangeiro
        "passaporte": None, "rnmRne": None, "validadeVisto": None, "tipoVisto": None,
        "resideExterior": "N", "tipoVistoEstrangeiro": 1,
        # RIC
        "regIdentidCivilNumero": "478215036", "regIdentidCivilUf": "SP",
        "regIdentidCivilCidade": "CAMPINAS", "regIdentidCivilOrgEmiss": "SSP",
        "regIdentidCivilDataExped": "2012-04-18",
        # Endereço
        "cep": "01452000", "logradouro": "Avenida Brigadeiro Faria Lima",
        "numero": "2845", "complemento": None, "bairro": "Jardim Paulistano",
        "cidade": "Sao Paulo", "uf": "SP",
        "pontoReferencia": "Próximo ao Shopping Iguatemi",
        "tipoLogradouroESocial": "AV", "municipioEnderecoIbge": 3550308,
        # Contato
        "email": f"mariana.qa.{cpf[-6:]}@qualiit-test.com.br",
        "emailAlternativo": None,
        "telefone": "33214567", "celular": "987651234",
        "dddTelefone": 11, "dddTelContato": 11,
        "contatoEmergenciaNome": "Sandra Regina Oliveira",
        "contatoEmergenciaFone": "11987651234",
        # Bancário (TipoConta enum: "ContaCorrente" = 0 / "ContaPoupanca" = 1 / "ContaSalario" = 2)
        "bancoCodigo": "341", "bancoNome": "Itaú Unibanco",
        "agencia": "3271", "agenciaDigito": "0",
        "conta": "2598431", "contaDigito": "8",
        "tipoConta": "ContaCorrente",
        # Trabalhista
        "estabelecimentoCodigo": "099", "codEmpresa": "1",
        "unitId": None, "areaId": None, "jobPositionId": None, "requisitoCategoriaId": None,
        "dataAdmissao": "2026-04-21", "salario": 5240.00,
        "tipoContratacao": "CLT", "cargaHorariaSemanal": 44,
        "pisPasep": "20754193628",
        # TOTVS
        "codCargoTotvs": 427, "codVinculoEmpregaticio": 10,
        "tipoFuncionario": 1, "categoriaSalarial": 1, "grauInstrucao": 7,
        "codTurno": 1,
        "centroCusto": "99999", "unidadeLotacao": "00001001",
        "codPlanoLotacao": 101, "codTurma": 1,
        "numCartaoPonto": 28201475, "codNivel": 1,
        "tipoMaoDeObra": "ADM", "formaPagamento": 1,
        "salarioSimulado": 5240.00,
        "origemFuncionario": 1, "indFuncVinculado": 1, "funcQualificado": "S",
        # FGTS/INSS
        "optanteFgts": "S", "dataOpcaoFgts": "2026-04-21",
        "tipoAdmissaoFgts": 1, "recolheFgts": "S", "recolheInss": "S",
        # Sindicato
        "sindicalizado": "N", "descContribSindical": "N",
        "contribSindicDia": "S", "codSindicato": 1,
        # Flags cálculo
        "cargaAutomTurno": "S", "recebePericul": "N", "recebeInsalub": "N",
        "recebeAdiantamento": "N", "considEmissRAIS": "S",
        "calcula13": "S", "recebeFerias": "S",
        # Provisões 13
        "avos13SalCalcAnterior": 0, "avos13SalCalc": 0,
        "provAcum13Sal": 0, "provAcumInss13Sal": 0, "provAcumFgts13Sal": 0,
        # Provisões Férias
        "diasProvFeriasMesAnterior": 0, "diasProvFeriasMesAtual": 0,
        "provAcumFerias": 0, "provAcumInssFerias": 0,
        "provAcumFgtsFerias": 0, "provAcumFerias13": 0,
        # Ponto
        "emitCartPonto": "1",
        "codLocalMarcacao": 1, "codClassFuncPontoEletronico": 1,
        # Docs avulsos
        "tituloEleitorNumero": "21459683022",
        "tituloEleitorZona": "312", "tituloEleitorSecao": "215",
        "tituloEleitorCidade": "CAMPINAS", "tituloEleitorUf": "SP",
        "reservistaNumero": None,
        "categoriaCnh": "B", "validadeCnh": "2029-08-15",
        "ctps": "78921", "ctpsSerie": "354", "ctpsUf": "SP",
        "ctpsModelo": 3, "ctpsSerieESocial": "354",
        "cnhNumero": "08745126930", "cnhUf": "SP", "cnhOrgaoEmissor": "SSP",
        "cnhDataExpedicao": 15082024, "cnhPrimeiraHabilitacao": 22092014,
        # Doc Militar (TOTVS rejeita tipo < 1 mesmo para mulheres)
        "docMilitarTipo": 1, "docMilitarNumero": "412687", "docMilitarSerie": "B",
        "docMilitarRegiao": 2, "docMilitarCircunscricao": 1,
        # Saúde
        "grupoSanguineo": 2, "fatorRh": 1,
        "possuiDeficiencia": "N", "funcDoador": "S",
        "cartaoSus": "70004193825",
        "altura": 165, "peso": 62,
        "cutis": 1, "cabelo": 2, "olhos": 2,
        "manequim": 38, "sapato": 36,
        # Contrato
        "dataTerminoContrato": None,
        # Localidade
        "paisLocalidade": "BRA", "codLocalidade": 17, "codFpas": None,
        # eSocial
        "categoriaTrabalhoESocial": 101,
        "indAdmissao": 1, "naturezaAtividade": 1,
        "municipioNascimentoIbge": 3509502,
        "tipoAdmissaoESocial": 1,
        "regimeTrabalhista": 1, "regimePrevidenciario": 1, "regimeJornada": 1,
        "matriculaESocial": None,
        # Estatística + CAGED (TOTVS exige >= 1)
        "tipoEstatistica": 1, "ocorrenciaCAGED": 1,
        "codRegistroExterior": None,
        "validacaoSalarioJustificativa": None,
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
    nome = f"Mariana QA {cpf[-4:]}"
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
