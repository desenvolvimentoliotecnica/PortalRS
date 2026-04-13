/**
 * Shared types and utilities for working with the organograma structure.
 * Used by feature screens that need hierarchical employee filtering.
 */

export interface OrgFuncionarioDto {
    id: string;
    nome: string;
    cargo: string | null;
    nivelHierarquicoOrdem: number | null;
}

export interface OrgLotacaoDto {
    id: string;
    codigo: string;
    descricao: string;
    parentId: string | null;
    responsavel: OrgFuncionarioDto | null;
    funcionarios: OrgFuncionarioDto[];
}

export interface OrgEstruturaResponse {
    lotacoes: OrgLotacaoDto[];
    semLotacao: OrgFuncionarioDto[];
}

/**
 * A selectable funcionário entry in the hierarchical dropdown.
 * `depth` drives the visual indentation — 0 = manager's direct unit,
 * 1 = one level below, etc.
 * `isGestor` marks the responsável of each lotação.
 */
export interface SubordinadoEntry {
    type: "item";
    id: string;
    name: string;
    cargo: string | null;
    sublabel: string;
    isGestor: boolean;
    depth: number;
}

/**
 * Returns all direct and indirect subordinates of the given manager
 * as a depth-annotated list ordered by DFS traversal of the lotação hierarchy.
 *
 * Within each lotação the responsável appears first (isGestor=true) followed
 * by other funcionários sorted by name. Child lotações are visited after
 * the parent's own employees, increasing depth by 1.
 *
 * The manager themselves is excluded. Detection checks both `responsavel`
 * and `funcionarios` so it works regardless of how the API returns them.
 *
 * Returns an empty array if the manager is not found in any lotação.
 */
export function getSubordinados(
    orgRes: OrgEstruturaResponse,
    meuFuncId: string,
): SubordinadoEntry[] {
    // 1. Find the manager's lotação
    let meuLotId: string | null = null;
    for (const lot of orgRes.lotacoes) {
        if (
            lot.responsavel?.id === meuFuncId ||
            lot.funcionarios.some((f) => f.id === meuFuncId)
        ) {
            meuLotId = lot.id;
            break;
        }
    }

    if (!meuLotId) return [];

    const lotMap = new Map(orgRes.lotacoes.map((l) => [l.id, l]));
    const seen = new Set<string>();
    const result: SubordinadoEntry[] = [];

    // 2. DFS — gestor first, then other funcionários, then children
    function visit(lotId: string, depth: number) {
        const lot = lotMap.get(lotId);
        if (!lot) return;

        const sublabel = `${lot.codigo} – ${lot.descricao}`;

        // Responsável/gestor first (unless the logged-in manager themselves)
        if (lot.responsavel && lot.responsavel.id !== meuFuncId && !seen.has(lot.responsavel.id)) {
            seen.add(lot.responsavel.id);
            result.push({
                type: "item",
                id: lot.responsavel.id,
                name: lot.responsavel.nome,
                cargo: lot.responsavel.cargo,
                sublabel,
                isGestor: true,
                depth,
            });
        }

        // Remaining funcionários, sorted by name
        const funcs = lot.funcionarios
            .filter((f) => f.id !== meuFuncId && !seen.has(f.id))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        for (const f of funcs) {
            seen.add(f.id);
            result.push({
                type: "item",
                id: f.id,
                name: f.nome,
                cargo: f.cargo,
                sublabel,
                isGestor: false,
                depth,
            });
        }

        // Recurse into child lotações (sorted by description), increasing depth
        const children = orgRes.lotacoes
            .filter((l) => l.parentId === lotId)
            .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));

        for (const child of children) {
            visit(child.id, depth + 1);
        }
    }

    visit(meuLotId, 0);
    return result;
}

/**
 * Filters a SubordinadoEntry list by query (name, cargo, or lotação).
 */
export function filterSubordinadoEntries(entries: SubordinadoEntry[], query: string): SubordinadoEntry[] {
    if (!query.trim()) return entries;

    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const q = norm(query);

    return entries.filter(
        (e) =>
            norm(e.name).includes(q) ||
            norm(e.sublabel).includes(q) ||
            (e.cargo ? norm(e.cargo).includes(q) : false),
    );
}
