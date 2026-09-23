export const ETAPA1_SQL_SCRIPT = `-- ==============================================================================
-- FORPACK GESTÃO INDUSTRIAL · ETAPA 1: ESTRUTURAÇÃO DO BANCO & MIGRAÇÃO
-- ==============================================================================
-- Este script executa de forma segura e não-destrutiva:
-- 1. Cria as novas tabelas relacionais de Pedidos/OP, Máquinas, Apontamentos,
--    Insumos/Matérias-primas, Estoque Semi-Acabado e Custos por Setor.
-- 2. Migra automaticamente 100% dos dados históricos de 'app_storage'.
-- 3. Configura índices de alta performance e políticas de acesso (RLS).
-- ==============================================================================

-- 1. TABELA DE MÁQUINAS
CREATE TABLE IF NOT EXISTS public.maquinas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  setor TEXT NOT NULL,
  ativa BOOLEAN DEFAULT true,
  custo_hora_padrao NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE PEDIDOS E ORDENS DE PRODUÇÃO (OP)
CREATE TABLE IF NOT EXISTS public.pedidos_op (
  id TEXT PRIMARY KEY,
  numero_op TEXT,
  numero_pedido TEXT,
  data_emissao DATE,
  cliente TEXT NOT NULL,
  descricao_item TEXT NOT NULL,
  quantidade_planejada_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria_produto TEXT,
  status_producao TEXT DEFAULT 'AGUARDANDO PROGRAMAÇÃO',
  material TEXT,
  observacao TEXT,
  maquina_id TEXT REFERENCES public.maquinas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  prioridade INTEGER DEFAULT 0,
  ordem_fila INTEGER,
  data_conclusao TIMESTAMPTZ,
  tipo_prazo TEXT,
  data_chegada_cliche DATE,
  fechamento JSONB,
  historico_status JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE APONTAMENTOS DE PRODUÇÃO
CREATE TABLE IF NOT EXISTS public.apontamentos_producao (
  id TEXT PRIMARY KEY,
  op_id TEXT REFERENCES public.pedidos_op(id) ON UPDATE CASCADE ON DELETE CASCADE,
  maquina_id TEXT REFERENCES public.maquinas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  setor TEXT,
  data_producao DATE NOT NULL,
  turno TEXT,
  operador TEXT,
  qtd_produzida_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  aparas_kg NUMERIC(12,2) DEFAULT 0,
  picote_kg NUMERIC(12,2) DEFAULT 0,
  horas_trabalhadas NUMERIC(6,2) DEFAULT 0,
  material TEXT,
  descricao_item TEXT,
  cliente TEXT,
  legacy_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE INSUMOS E MATÉRIAS-PRIMAS (Com Custos e Estoque)
CREATE TABLE IF NOT EXISTS public.insumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL, -- 'RESINA', 'MASTERBATCH', 'TINTA', 'SOLVENTE', 'ADESIVO', 'EMBALAGEM', 'OUTRO'
  unidade_medida TEXT DEFAULT 'KG', -- 'KG', 'L', 'UN'
  estoque_atual NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,2) DEFAULT 0,
  custo_unitario_medio NUMERIC(12,4) NOT NULL DEFAULT 0, -- R$/kg ou R$/L
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABELA DE ESTOQUE SEMI-ACABADO (Bobinas intermediárias / WIP)
CREATE TABLE IF NOT EXISTS public.estoque_semiacabados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  op_id TEXT REFERENCES public.pedidos_op(id) ON UPDATE CASCADE ON DELETE CASCADE,
  numero_bobina TEXT,
  setor_origem TEXT NOT NULL,
  setor_destino TEXT,
  peso_liquido_kg NUMERIC(12,2) NOT NULL,
  largura_mm NUMERIC(8,2),
  espessura_micras NUMERIC(8,2),
  status TEXT DEFAULT 'DISPONIVEL', -- 'DISPONIVEL', 'EM_PROCESSO', 'CONSUMIDO', 'REJEITADO'
  data_fabricacao DATE DEFAULT CURRENT_DATE,
  operador TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE MOVIMENTAÇÕES DE ESTOQUE (Rastreabilidade Auditável)
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_movimento TEXT NOT NULL, -- 'ENTRADA_COMPRA', 'CONSUMO_PRODUCAO', 'PRODUCAO_SEMIACABADO', 'PRODUCAO_ACABADO', 'APARA_REFUGO', 'AJUSTE_INVENTARIO'
  tipo_item TEXT NOT NULL,      -- 'INSUMO', 'SEMI_ACABADO', 'PRODUTO_ACABADO'
  item_id TEXT,
  op_id TEXT,
  setor TEXT,
  quantidade NUMERIC(12,2) NOT NULL,
  custo_unitario NUMERIC(12,4) DEFAULT 0,
  documento_referencia TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABELA DE CONFIGURAÇÃO DE CUSTOS POR SETOR
CREATE TABLE IF NOT EXISTS public.custos_setor_config (
  setor TEXT PRIMARY KEY, -- 'EXTRUSÃO', 'IMPRESSÃO', 'LAMINAÇÃO', 'REBOBINADEIRA', 'CORTE'
  custo_hora_maquina NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_hora_homem NUMERIC(10,2) NOT NULL DEFAULT 0,
  perda_padrao_tolerada_pct NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABELA DE CADASTROS DE APOIO (Listas operacionais)
CREATE TABLE IF NOT EXISTS public.cadastros_apoio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL, -- 'operadores', 'clientes', 'produtos', 'materiais'
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tipo, nome)
);

-- ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pedidos_op_status ON public.pedidos_op(status_producao);
CREATE INDEX IF NOT EXISTS idx_pedidos_op_maquina ON public.pedidos_op(maquina_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_op ON public.apontamentos_producao(op_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_data ON public.apontamentos_producao(data_producao);
CREATE INDEX IF NOT EXISTS idx_apontamentos_setor ON public.apontamentos_producao(setor);
CREATE INDEX IF NOT EXISTS idx_semiacabados_op ON public.estoque_semiacabados(op_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_op ON public.estoque_movimentacoes(op_id);

-- ==============================================================================
-- MIGRAÇÃO DE DADOS HISTÓRICOS (De app_storage para o modelo relacional)
-- ==============================================================================

-- A. Migrar Máquinas
INSERT INTO public.maquinas (id, nome, setor)
SELECT 
  elem->>'id' AS id,
  COALESCE(elem->>'name', elem->>'id') AS nome,
  UPPER(COALESCE(elem->>'setor', 'OUTROS')) AS setor
FROM public.app_storage,
LATERAL jsonb_array_elements(value::jsonb) AS elem
WHERE key = 'config:maquinas'
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  setor = EXCLUDED.setor;

-- B. Migrar Pedidos e OPs
INSERT INTO public.pedidos_op (
  id, numero_op, numero_pedido, data_emissao, cliente, descricao_item,
  quantidade_planejada_kg, categoria_produto, status_producao, material,
  observacao, maquina_id, prioridade, ordem_fila, data_conclusao,
  tipo_prazo, data_chegada_cliche, fechamento, historico_status, updated_at
)
SELECT
  (value::jsonb)->>'id' AS id,
  (value::jsonb)->>'numeroOp' AS numero_op,
  (value::jsonb)->>'numeroPedido' AS numero_pedido,
  CASE 
    WHEN (value::jsonb)->>'data' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN ((value::jsonb)->>'data')::date 
    ELSE NULL 
  END AS data_emissao,
  COALESCE((value::jsonb)->>'cliente', 'Cliente não informado') AS cliente,
  COALESCE((value::jsonb)->>'descricaoItem', 'Item não especificado') AS descricao_item,
  COALESCE(NULLIF(regexp_replace((value::jsonb)->>'quantidade', '[^\\d.]', '', 'g'), '')::numeric, 0) AS quantidade_planejada_kg,
  (value::jsonb)->>'categoriaProduto' AS categoria_produto,
  COALESCE((value::jsonb)->>'statusProducao', 'AGUARDANDO PROGRAMAÇÃO') AS status_producao,
  (value::jsonb)->>'material' AS material,
  (value::jsonb)->>'observacao' AS observacao,
  NULLIF((value::jsonb)->>'maquinaId', '') AS maquina_id,
  COALESCE(((value::jsonb)->>'prioridade')::integer, 0) AS prioridade,
  ((value::jsonb)->>'ordemFila')::integer AS ordem_fila,
  CASE 
    WHEN (value::jsonb)->>'dataConclusao' IS NOT NULL THEN ((value::jsonb)->>'dataConclusao')::timestamptz 
    ELSE NULL 
  END AS data_conclusao,
  (value::jsonb)->>'tipoPrazo' AS tipo_prazo,
  CASE 
    WHEN (value::jsonb)->>'dataChegadaCliche' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN ((value::jsonb)->>'dataChegadaCliche')::date 
    ELSE NULL 
  END AS data_chegada_cliche,
  (value::jsonb)->'fechamento' AS fechamento,
  (value::jsonb)->'historicoStatus' AS historico_status,
  updated_at
FROM public.app_storage
WHERE key LIKE 'pedido:%'
ON CONFLICT (id) DO UPDATE SET
  numero_op = EXCLUDED.numero_op,
  numero_pedido = EXCLUDED.numero_pedido,
  cliente = EXCLUDED.cliente,
  descricao_item = EXCLUDED.descricao_item,
  quantidade_planejada_kg = EXCLUDED.quantidade_planejada_kg,
  categoria_produto = EXCLUDED.categoria_produto,
  status_producao = EXCLUDED.status_producao,
  material = EXCLUDED.material,
  observacao = EXCLUDED.observacao,
  maquina_id = EXCLUDED.maquina_id,
  prioridade = EXCLUDED.prioridade,
  ordem_fila = EXCLUDED.ordem_fila,
  data_conclusao = EXCLUDED.data_conclusao,
  fechamento = EXCLUDED.fechamento,
  historico_status = EXCLUDED.historico_status,
  updated_at = EXCLUDED.updated_at;

-- C. Migrar Apontamentos de Produção
INSERT INTO public.apontamentos_producao (
  id, op_id, maquina_id, setor, data_producao, turno, operador,
  qtd_produzida_kg, aparas_kg, picote_kg, material, descricao_item, cliente, legacy_key, updated_at
)
SELECT
  COALESCE((value::jsonb)->>'id', key) AS id,
  (value::jsonb)->>'idPedido' AS op_id,
  NULLIF((value::jsonb)->>'maquinaId', '') AS maquina_id,
  COALESCE(m.setor, 'EXTRUSÃO') AS setor,
  CASE 
    WHEN (value::jsonb)->>'dataProducao' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN ((value::jsonb)->>'dataProducao')::date 
    ELSE CURRENT_DATE 
  END AS data_producao,
  (value::jsonb)->>'turno' AS turno,
  (value::jsonb)->>'operador' AS operador,
  COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'qtdProduzido', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0) AS qtd_produzida_kg,
  COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'aparas', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0) AS aparas_kg,
  COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'picote', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0) AS picote_kg,
  (value::jsonb)->>'material' AS material,
  (value::jsonb)->>'descricaoItem' AS descricao_item,
  (value::jsonb)->>'cliente' AS cliente,
  key AS legacy_key,
  updated_at
FROM public.app_storage s
LEFT JOIN public.maquinas m ON m.id = (s.value::jsonb)->>'maquinaId'
WHERE s.key LIKE 'record:%'
ON CONFLICT (id) DO UPDATE SET
  qtd_produzida_kg = EXCLUDED.qtd_produzida_kg,
  aparas_kg = EXCLUDED.aparas_kg,
  picote_kg = EXCLUDED.picote_kg,
  turno = EXCLUDED.turno,
  operador = EXCLUDED.operador,
  updated_at = EXCLUDED.updated_at;

-- D. Migrar Cadastros Operacionais (Operadores, Clientes, Produtos, Materiais)
INSERT INTO public.cadastros_apoio (tipo, nome)
SELECT 'operadores', elem::text
FROM public.app_storage, LATERAL jsonb_array_elements_text(value::jsonb) AS elem
WHERE key = 'config:operadores'
ON CONFLICT (tipo, nome) DO NOTHING;

INSERT INTO public.cadastros_apoio (tipo, nome)
SELECT 'clientes', elem::text
FROM public.app_storage, LATERAL jsonb_array_elements_text(value::jsonb) AS elem
WHERE key = 'config:clientes'
ON CONFLICT (tipo, nome) DO NOTHING;

INSERT INTO public.cadastros_apoio (tipo, nome)
SELECT 'produtos', elem::text
FROM public.app_storage, LATERAL jsonb_array_elements_text(value::jsonb) AS elem
WHERE key = 'config:produtos'
ON CONFLICT (tipo, nome) DO NOTHING;

INSERT INTO public.cadastros_apoio (tipo, nome)
SELECT 'materiais', elem::text
FROM public.app_storage, LATERAL jsonb_array_elements_text(value::jsonb) AS elem
WHERE key = 'config:materiais'
ON CONFLICT (tipo, nome) DO NOTHING;

-- E. Inicializar Custos Padrão por Setor da FORPACK
INSERT INTO public.custos_setor_config (setor, custo_hora_maquina, custo_hora_homem, perda_padrao_tolerada_pct)
VALUES
  ('EXTRUSÃO', 120.00, 35.00, 3.5),
  ('IMPRESSÃO', 150.00, 40.00, 4.0),
  ('LAMINAÇÃO', 110.00, 35.00, 2.5),
  ('REBOBINADEIRA', 70.00, 30.00, 1.5),
  ('CORTE', 65.00, 30.00, 2.0)
ON CONFLICT (setor) DO NOTHING;

-- F. Inicializar Insumos Base para Testes de Estoque
INSERT INTO public.insumos (codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, custo_unitario_medio)
VALUES
  ('MP-PEBD-01', 'Resina Polietileno Baixa Densidade (PEBD)', 'RESINA', 'KG', 12500.00, 3000.00, 7.85),
  ('MP-PEAD-01', 'Resina Polietileno Alta Densidade (PEAD)', 'RESINA', 'KG', 8400.00, 2500.00, 7.95),
  ('MP-PELBD-01', 'Resina Polietileno Linear (PELBD)', 'RESINA', 'KG', 6200.00, 2000.00, 8.10),
  ('MB-BRANCO-01', 'Masterbatch Branco Especial', 'MASTERBATCH', 'KG', 650.00, 150.00, 14.50),
  ('MB-PRETO-01', 'Masterbatch Preto Alta Cobertura', 'MASTERBATCH', 'KG', 420.00, 100.00, 12.80),
  ('TI-AZUL-01', 'Tinta Flexográfica Azul Cyan', 'TINTA', 'KG', 180.00, 50.00, 28.50),
  ('SO-ETANOL-01', 'Solvente Etanol Anidro P.A.', 'SOLVENTE', 'L', 800.00, 200.00, 6.20),
  ('AD-POLI-01', 'Adesivo Laminação Base Solvente', 'ADESIVO', 'KG', 350.00, 100.00, 22.00)
ON CONFLICT (codigo) DO NOTHING;

-- ==============================================================================
-- POLÍTICAS DE ACESSO (RLS) - Acesso liberado com anon key
-- ==============================================================================
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apontamentos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_semiacabados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_setor_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastros_apoio ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Acesso maquinas" ON public.maquinas;
  CREATE POLICY "Acesso maquinas" ON public.maquinas FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso pedidos_op" ON public.pedidos_op;
  CREATE POLICY "Acesso pedidos_op" ON public.pedidos_op FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso apontamentos_producao" ON public.apontamentos_producao;
  CREATE POLICY "Acesso apontamentos_producao" ON public.apontamentos_producao FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso insumos" ON public.insumos;
  CREATE POLICY "Acesso insumos" ON public.insumos FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso estoque_semiacabados" ON public.estoque_semiacabados;
  CREATE POLICY "Acesso estoque_semiacabados" ON public.estoque_semiacabados FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso estoque_movimentacoes" ON public.estoque_movimentacoes;
  CREATE POLICY "Acesso estoque_movimentacoes" ON public.estoque_movimentacoes FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso custos_setor_config" ON public.custos_setor_config;
  CREATE POLICY "Acesso custos_setor_config" ON public.custos_setor_config FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Acesso cadastros_apoio" ON public.cadastros_apoio;
  CREATE POLICY "Acesso cadastros_apoio" ON public.cadastros_apoio FOR ALL USING (true) WITH CHECK (true);
END $$;
`;

export const ETAPA1_VALIDATION_SQL = `-- ==============================================================================
-- QUERY DE VALIDAÇÃO CRUZADA (Auditoria de Integridade dos Dados Migrados)
-- Execute no Supabase SQL Editor para garantir que nenhum dado foi perdido:
-- ==============================================================================

SELECT 
  'Contagem de Pedidos / OPs' AS metrica,
  (SELECT COUNT(*) FROM public.app_storage WHERE key LIKE 'pedido:%') AS total_legado_storage,
  (SELECT COUNT(*) FROM public.pedidos_op) AS total_migrado_relacional,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.app_storage WHERE key LIKE 'pedido:%') = (SELECT COUNT(*) FROM public.pedidos_op) 
    THEN '✅ 100% CONFERIDO' 
    ELSE '⚠️ DIVERGÊNCIA' 
  END AS status

UNION ALL

SELECT 
  'Contagem de Apontamentos',
  (SELECT COUNT(*) FROM public.app_storage WHERE key LIKE 'record:%'),
  (SELECT COUNT(*) FROM public.apontamentos_producao),
  CASE 
    WHEN (SELECT COUNT(*) FROM public.app_storage WHERE key LIKE 'record:%') = (SELECT COUNT(*) FROM public.apontamentos_producao) 
    THEN '✅ 100% CONFERIDO' 
    ELSE '⚠️ DIVERGÊNCIA' 
  END

UNION ALL

SELECT 
  'Total Kg Produzidos Acumulado',
  (SELECT ROUND(SUM(COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'qtdProduzido', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0)), 2) FROM public.app_storage WHERE key LIKE 'record:%'),
  (SELECT ROUND(SUM(qtd_produzida_kg), 2) FROM public.apontamentos_producao),
  CASE 
    WHEN (SELECT ROUND(SUM(COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'qtdProduzido', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0)), 2) FROM public.app_storage WHERE key LIKE 'record:%') = 
         (SELECT ROUND(SUM(qtd_produzida_kg), 2) FROM public.apontamentos_producao)
    THEN '✅ 100% CONFERIDO' 
    ELSE '⚠️ DIVERGÊNCIA' 
  END

UNION ALL

SELECT 
  'Total Kg Aparas/Refugo',
  (SELECT ROUND(SUM(COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'aparas', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0)), 2) FROM public.app_storage WHERE key LIKE 'record:%'),
  (SELECT ROUND(SUM(aparas_kg), 2) FROM public.apontamentos_producao),
  CASE 
    WHEN (SELECT ROUND(SUM(COALESCE(NULLIF(replace(replace(regexp_replace((value::jsonb)->>'aparas', '[^\\d,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric, 0)), 2) FROM public.app_storage WHERE key LIKE 'record:%') = 
         (SELECT ROUND(SUM(aparas_kg), 2) FROM public.apontamentos_producao)
    THEN '✅ 100% CONFERIDO' 
    ELSE '⚠️ DIVERGÊNCIA' 
  END;
`;
