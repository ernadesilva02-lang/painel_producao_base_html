export const SECTORS = ["EXTRUSÃO", "LAMINAÇÃO", "IMPRESSÃO", "REBOBINADEIRA", "CORTE"] as const;
export type Sector = typeof SECTORS[number];

export type StorageRow = { key: string; value: string; updated_at: string };

export type Machine = { id: string; name: string; setor: string };

export type ClosureSnapshot = {
  responsavel: string;
  observacao?: string;
  data: string;
  pesoInicial: number;
  pesoFinal: number;
  perdaReal: number;
  perdaDeclarada: number;
  divergencia: number;
  aproveitamento: number;
};

export type StatusEvent = {
  acao: "FECHAMENTO" | "REABERTURA";
  data: string;
  responsavel: string;
  observacao?: string;
};

export type DeadlineRule = "LISO" | "IMPRESSO_REPETICAO" | "IMPRESSO_NOVO";

export type ProductCategory =
  | "SACO_LISO"
  | "SACO_IMPRESSO"
  | "SACO_LAMINADO"
  | "FILME_LISO"
  | "FILME_IMPRESSO"
  | "FILME_LAMINADO"
  | "NAO_CLASSIFICADO";

export type Order = {
  id: string;
  numeroOp?: string;
  numeroPedido?: string;
  data: string;
  cliente: string;
  descricaoItem: string;
  quantidade: string;
  categoriaProduto?: ProductCategory;
  statusProducao?: string;
  material?: string;
  observacao?: string;
  maquinaId?: string;
  prioridade?: number;
  ordemFila?: number;
  dataConclusao?: string;
  tipoPrazo?: DeadlineRule;
  dataChegadaCliche?: string;
  fechamento?: ClosureSnapshot;
  historicoStatus?: StatusEvent[];
};

export type Production = {
  id?: string;
  idPedido?: string;
  maquinaId?: string;
  qtdProduzido?: string;
  dataProducao?: string;
  turno?: string;
  operador?: string;
  aparas?: string;
  picote?: string;
  cliente?: string;
  descricaoItem?: string;
  material?: string;
  _key?: string;
  _updatedAt?: string;
};

export type Totals = Record<string, number>;

export type RegistryKind = "operadores" | "clientes" | "produtos" | "materiais";

export type RegistryData = Record<RegistryKind, string[]>;

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "SACO_LISO", label: "Saco liso" },
  { value: "SACO_IMPRESSO", label: "Saco impresso" },
  { value: "SACO_LAMINADO", label: "Saco laminado" },
  { value: "FILME_LISO", label: "Filme liso" },
  { value: "FILME_IMPRESSO", label: "Filme impresso" },
  { value: "FILME_LAMINADO", label: "Filme laminado" },
  { value: "NAO_CLASSIFICADO", label: "Não classificado" },
];
