export const SECTORS = ["EXTRUSÃO", "LAMINAÇÃO", "IMPRESSÃO", "REBOBINADEIRA", "CORTE"] as const;
export type Sector = typeof SECTORS[number];

export type StorageRow = { key: string; value: string; updated_at: string };

export type Machine = { id: string; name: string; setor: string };

export type LaudoTecnico = {
  numeroLaudo: string;
  lote: string;
  dataEmissao: string;
  inspetor: string;
  espessuraConferidaMicras?: number;
  larguraConferidaMm?: number;
  resistenciaTracaoSolda?: "APROVADO" | "RESSALVA" | "REPROVADO";
  qualidadeImpressao?: "APROVADO" | "NAO_APLICAVEL" | "RESSALVA";
  tratamentoCoronaDinas?: number;
  aparenciaGeral?: "CONFORME" | "NAO_CONFORME";
  statusLiberacao: "LIBERADO" | "LIBERADO_COM_RESSALVA" | "REPROVADO";
  observacoesQualidade?: string;
};

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
  insumoBaixadoId?: string;
  insumoBaixadoNome?: string;
  quantidadeBaixadaKg?: number;
  sobraBobinaKg?: number;
  sobraNumeroBobina?: string;
  laudoTecnico?: LaudoTecnico;
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

export type InsumoCategoria =
  | "RESINA"
  | "MASTERBATCH"
  | "TINTA"
  | "SOLVENTE"
  | "ADESIVO"
  | "EMBALAGEM"
  | "OUTRO";

export type UnidadeMedida = "KG" | "L" | "UN" | "M";

export type Insumo = {
  id: string;
  codigo: string;
  nome: string;
  categoria: InsumoCategoria;
  unidade_medida: UnidadeMedida;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario_medio: number; // R$ por unidade/kg
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CustoSetorConfig = {
  setor: Sector | string;
  custo_hora_maquina: number; // R$/hora
  custo_hora_homem: number;   // R$/hora
  perda_padrao_tolerada_pct: number; // %
  updated_at?: string;
};

export type FichaTecnicaItem = {
  insumo_id?: string;
  insumo_codigo?: string;
  insumo_nome: string;
  proporcao_percentual: number; // ex: 96% resina, 4% masterbatch
  custo_estimado_kg?: number;
};

export type FichaTecnica = {
  id: string;
  categoriaProduto: ProductCategory;
  nomePadrao: string;
  setoresProcesso: Sector[];
  composicao: FichaTecnicaItem[];
  perdaEstimadaPct: number;
  velocidadeMediaKgHora: number; // kg/h produtividade média
  observacoes?: string;
};

export type StatusBobina = "DISPONIVEL" | "EM_USO" | "CONSUMIDA" | "REFUGADA";

export type BobinaSemiAcabada = {
  id: string;
  op_id: string;
  numero_bobina: string;
  setor_origem: Sector | string;
  setor_destino?: Sector | string | null;
  peso_liquido_kg: number;
  largura_mm?: number | null;
  espessura_micras?: number | null;
  status: StatusBobina;
  data_fabricacao: string;
  operador?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TipoMovimentoEstoque =
  | "ENTRADA_COMPRA"
  | "CONSUMO_OP"
  | "TRANSFERENCIA_WIP"
  | "AJUSTE_INVENTARIO"
  | "RETORNO_APARA";

export type MovimentacaoEstoque = {
  id: string;
  tipo_movimento: TipoMovimentoEstoque;
  tipo_item: "INSUMO" | "SEMIACABADO";
  item_id?: string | null;
  item_nome?: string | null;
  op_id?: string | null;
  setor?: Sector | string | null;
  quantidade: number;
  unidade?: string | null;
  custo_unitario?: number | null;
  documento_referencia?: string | null;
  observacao?: string | null;
  created_at?: string;
};

export type CustoSetorDetalhe = {
  setor: Sector | string;
  kg_produzidos: number;
  horas_estimadas: number;
  taxa_hora_maquina: number;
  taxa_hora_homem: number;
  custo_maquina: number;
  custo_homem: number;
  subtotal_operacional: number;
};

export type OpFinancialSummary = {
  op_id: string;
  cliente: string;
  descricao_item: string;
  material: string;
  quantidade_planejada_kg: number;
  quantidade_final_kg: number;
  aparas_total_kg: number;
  perda_real_pct: number;
  custo_materia_prima_kg: number;
  custo_total_materia_prima: number;
  detalhe_setores: CustoSetorDetalhe[];
  custo_total_operacional: number;
  custo_liquido_aparas: number;
  custo_total_fabricacao: number;
  custo_real_por_kg: number;
  preco_venda_kg: number;
  receita_total: number;
  lucro_bruto: number;
  margem_lucro_pct: number;
  status_lucratividade: "ALTA" | "NORMAL" | "APERTADA" | "PREJUIZO";
  data_ultima_producao?: string;
};

export type StatusPalete = "ABERTO" | "FECHADO" | "CANCELADO";

export type ItemPaleteRomaneio = {
  posicao: number;          // 1..80
  pesoBruto: number;        // ex: 49.3
  tara: number;             // ex: 1.6
  pesoLiquido: number;      // ex: 47.7
  codigoBobina?: string;    // ex: BOB-01
  horario?: string;
};

export type PaleteRomaneio = {
  id: string;
  numeroPalete: string;      // ex: "PAL-9684-01"
  opId: string;              // ID da OP ou número
  numeroOp?: string;
  numeroPedido?: string;
  cliente: string;
  descricaoItem: string;
  maquinaId: string;
  maquinaNome?: string;
  setor: Sector | string;    // ex: "REBOBINADEIRA"
  data: string;              // YYYY-MM-DD
  turno: string;             // "1º Turno (06h - 14h)", etc.
  operador: string;
  auxiliar?: string;
  taraPadraoTubete: number;  // ex: 1.6 kg
  itens: ItemPaleteRomaneio[];
  totalVolumes: number;      // contagem de bobinas
  pesoBrutoTotal: number;    // soma bruto kg
  taraTotal: number;         // soma tara kg
  pesoLiquidoTotal: number;  // soma líquido kg
  status: StatusPalete;
  observacoes?: string;
  idApontamentoProducao?: string; // id do record de produção gerado no fechamento
  created_at?: string;
  updated_at?: string;
  fechado_em?: string;
  _key?: string;
  _updatedAt?: string;
};
