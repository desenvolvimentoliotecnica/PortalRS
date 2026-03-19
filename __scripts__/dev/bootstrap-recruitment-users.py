#!/usr/bin/env python3
"""
Cria/atualiza os usuários de teste para o fluxo de recrutamento.

O script:
1. autentica como admin do tenant informado;
2. garante os papéis "Gestor" e "Recrutador";
3. clona para esses papéis os mesmos menus/permissões do papel "Admin";
4. cria ou atualiza os usuários de teste;
5. garante um Funcionario vinculado para cada usuário e atribui área/unidade padrão;
6. valida o login final dos dois usuários.

Uso:
    python __scripts__/dev/bootstrap-recruitment-users.py

Variáveis opcionais:
    RENDERRH_API=http://localhost:5056
    RENDERRH_TENANT=dev
    RENDERRH_ADMIN_EMAIL=admin@dev.local
    RENDERRH_ADMIN_PASSWORD=ChangeThisPassword123!
    RENDERRH_GESTOR_EMAIL=gestor@dev.local
    RENDERRH_GESTOR_PASSWORD=ChangeThisPassword123!
    RENDERRH_RECRUTADOR_EMAIL=rh@dev.local
    RENDERRH_RECRUTADOR_PASSWORD=ChangeThisPassword123!
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


API_BASE = os.environ.get("RENDERRH_API", "http://localhost:5056").rstrip("/")
TENANT_ID = os.environ.get("RENDERRH_TENANT", "dev")
ADMIN_EMAIL = os.environ.get("RENDERRH_ADMIN_EMAIL", "admin@dev.local")
ADMIN_PASSWORD = os.environ.get("RENDERRH_ADMIN_PASSWORD", "ChangeThisPassword123!")

GESTOR_EMAIL = os.environ.get("RENDERRH_GESTOR_EMAIL", "gestor@dev.local")
GESTOR_PASSWORD = os.environ.get("RENDERRH_GESTOR_PASSWORD", "ChangeThisPassword123!")
GESTOR_NAME = os.environ.get("RENDERRH_GESTOR_NAME", "Gestor Teste")

RECRUTADOR_EMAIL = os.environ.get("RENDERRH_RECRUTADOR_EMAIL", "rh@dev.local")
RECRUTADOR_PASSWORD = os.environ.get("RENDERRH_RECRUTADOR_PASSWORD", "ChangeThisPassword123!")
RECRUTADOR_NAME = os.environ.get("RENDERRH_RECRUTADOR_NAME", "Recrutador Teste")


def api_request(
    path: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | list[Any] | None = None,
    token: str | None = None,
) -> Any:
    url = f"{API_BASE}{path}"
    payload = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Tenant-Id": TENANT_ID,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            if response.status == 204 or not raw.strip():
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc


def login(email: str, password: str) -> str:
    data = api_request(
        "/api/auth/login",
        method="POST",
        body={"email": email, "password": password},
    )
    token = str((data or {}).get("accessToken") or "")
    if not token:
        raise RuntimeError(f"Login sem token para {email}.")
    return token


def index_by_name(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in items:
        name = str(item.get("name") or "").strip().lower()
        if name:
            result[name] = item
    return result


def unique_menu_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        menu_id = str(item.get("menuId") or "").strip()
        permission_key = str(item.get("permissionKey") or "").strip()
        key = (menu_id, permission_key)
        if not menu_id or not permission_key or key in seen:
            continue
        seen.add(key)
        unique.append({"menuId": menu_id, "permissionKey": permission_key})
    return unique


def ensure_role(
    token: str,
    *,
    name: str,
    description: str,
    visibility_scope: str,
    vagas_data_scope: str,
    access_mode: str,
    admin_menu_items: list[dict[str, Any]],
) -> dict[str, Any]:
    roles = api_request("/api/roles", token=token)
    roles_by_name = index_by_name(roles if isinstance(roles, list) else [])
    existing = roles_by_name.get(name.lower())

    payload = {
        "name": name,
        "description": description,
        "isActive": True,
        "visibilityScope": visibility_scope,
        "vagasDataScope": vagas_data_scope,
        "accessMode": access_mode,
    }

    if existing:
        role = api_request(f"/api/roles/{existing['id']}", method="PUT", body=payload, token=token)
    else:
        role = api_request("/api/roles", method="POST", body=payload, token=token)

    api_request(
        f"/api/roles/{role['id']}/menus",
        method="PUT",
        body={"items": admin_menu_items},
        token=token,
    )
    return role


def ensure_user(
    token: str,
    *,
    email: str,
    full_name: str,
    password: str,
    role_id: str,
    default_unit_id: str | None,
) -> dict[str, Any]:
    users = api_request("/api/users", token=token)
    existing = None
    for item in users if isinstance(users, list) else []:
        if str(item.get("email") or "").strip().lower() == email.lower():
            existing = item
            break

    if existing:
        user_id = str(existing["id"])
        api_request(
            f"/api/users/{user_id}/roles",
            method="PUT",
            body={"roleIds": [role_id]},
            token=token,
        )
        api_request(
            f"/api/users/{user_id}/password",
            method="PUT",
            body={"newPassword": password},
            token=token,
        )
        if not bool(existing.get("isActive", True)):
            api_request(
                f"/api/users/{user_id}/status",
                method="PATCH",
                body={"isActive": True},
                token=token,
            )
        return api_request(f"/api/users/{user_id}", token=token)

    payload = {
        "email": email,
        "fullName": full_name,
        "password": password,
        "isActive": True,
        "roleIds": [role_id],
        "unitIds": [default_unit_id] if default_unit_id else [],
        "funcionarioId": None,
    }
    return api_request("/api/users", method="POST", body=payload, token=token)


def ensure_funcionario(
    token: str,
    *,
    user: dict[str, Any],
    area_id: str | None,
    unit_id: str | None,
) -> dict[str, Any]:
    funcionario = user.get("funcionario")
    if funcionario and funcionario.get("id"):
        funcionario_id = str(funcionario["id"])
        current = api_request(f"/api/funcionarios/{funcionario_id}", token=token)
        payload = {
            "name": current.get("name") or user.get("fullName") or "Usuário",
            "email": current.get("email") or user.get("email") or "",
            "phone": current.get("phone"),
            "status": current.get("status") or "Active",
            "headcount": current.get("headcount") or 0,
            "unitId": current.get("unitId") or unit_id,
            "areaId": current.get("areaId") or area_id,
            "jobPositionId": current.get("jobPositionId"),
            "requisitoCategoriaId": current.get("requisitoCategoriaId"),
            "notes": current.get("notes") or "Usuário de teste do fluxo de recrutamento.",
        }
        return api_request(f"/api/funcionarios/{funcionario_id}", method="PUT", body=payload, token=token)

    created = api_request(
        "/api/funcionarios",
        method="POST",
        body={
            "name": user.get("fullName") or "Usuário",
            "email": user.get("email") or "",
            "phone": None,
            "status": "Active",
            "headcount": 0,
            "unitId": unit_id,
            "areaId": area_id,
            "jobPositionId": None,
            "requisitoCategoriaId": None,
            "notes": "Usuário de teste do fluxo de recrutamento.",
            "userId": user.get("id"),
        },
        token=token,
    )
    return created or {}


def print_user_summary(label: str, user: dict[str, Any], role_name: str) -> None:
    funcionario = user.get("funcionario") or {}
    print(f"{label}:")
    print(f"  email: {user.get('email')}")
    print(f"  papel: {role_name}")
    print(f"  funcionarioId: {funcionario.get('id') or 'n/a'}")
    print(f"  areaId: {funcionario.get('areaId') or 'n/a'}")


def main() -> int:
    print(f"API: {API_BASE}")
    print(f"Tenant: {TENANT_ID}")

    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    print("Login admin: ok")

    roles = api_request("/api/roles", token=admin_token)
    roles_by_name = index_by_name(roles if isinstance(roles, list) else [])
    admin_role = roles_by_name.get("admin")
    if not admin_role:
        raise RuntimeError("Papel Admin não encontrado no tenant.")

    admin_menus = api_request(f"/api/roles/{admin_role['id']}/menus", token=admin_token)
    admin_menu_items = unique_menu_items(admin_menus if isinstance(admin_menus, list) else [])
    if not admin_menu_items:
        raise RuntimeError("Papel Admin sem menus/permissões para clonar.")

    areas = api_request("/api/lookup/areas", token=admin_token)
    units = api_request("/api/lookup/units", token=admin_token)
    default_area_id = str(areas[0]["id"]) if isinstance(areas, list) and areas else None
    default_unit_id = str(units[0]["id"]) if isinstance(units, list) and units else None

    gestor_role = ensure_role(
        admin_token,
        name="Gestor",
        description="Perfil de gestor para testar solicitações e aprovações dentro da tela de vagas.",
        visibility_scope="RestrictedByAreaOrRecruiter",
        vagas_data_scope="ByArea",
        access_mode="Full",
        admin_menu_items=admin_menu_items,
    )
    print("Papel Gestor: ok")

    recrutador_role = ensure_role(
        admin_token,
        name="Recrutador",
        description="Perfil de recrutador para testar gestão operacional de vagas e matching.",
        visibility_scope="RestrictedByAreaOrRecruiter",
        vagas_data_scope="ByRecrutador",
        access_mode="Full",
        admin_menu_items=admin_menu_items,
    )
    print("Papel Recrutador: ok")

    gestor_user = ensure_user(
        admin_token,
        email=GESTOR_EMAIL,
        full_name=GESTOR_NAME,
        password=GESTOR_PASSWORD,
        role_id=str(gestor_role["id"]),
        default_unit_id=default_unit_id,
    )
    ensure_funcionario(
        admin_token,
        user=gestor_user,
        area_id=default_area_id,
        unit_id=default_unit_id,
    )
    gestor_user = api_request(f"/api/users/{gestor_user['id']}", token=admin_token)
    print("Usuário Gestor: ok")

    recrutador_user = ensure_user(
        admin_token,
        email=RECRUTADOR_EMAIL,
        full_name=RECRUTADOR_NAME,
        password=RECRUTADOR_PASSWORD,
        role_id=str(recrutador_role["id"]),
        default_unit_id=default_unit_id,
    )
    ensure_funcionario(
        admin_token,
        user=recrutador_user,
        area_id=default_area_id,
        unit_id=default_unit_id,
    )
    recrutador_user = api_request(f"/api/users/{recrutador_user['id']}", token=admin_token)
    print("Usuário Recrutador: ok")

    login(GESTOR_EMAIL, GESTOR_PASSWORD)
    print("Login Gestor: ok")
    login(RECRUTADOR_EMAIL, RECRUTADOR_PASSWORD)
    print("Login Recrutador: ok")

    print()
    print_user_summary("Gestor", gestor_user, "Gestor")
    print(f"  senha: {GESTOR_PASSWORD}")
    print_user_summary("Recrutador", recrutador_user, "Recrutador")
    print(f"  senha: {RECRUTADOR_PASSWORD}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1)
