# Painel de Produção — Versão 10

Versão preparada para publicação com GitHub e Vercel usando Next.js.

## Principais melhorias incluídas

- Programação PCP por máquina e por data do pedido.
- Sequência manual com controles para subir e descer pedidos.
- Menu de três pontos para alteração de máquina.
- Coluna de quantidade produzida destacada em verde.
- Descrição ampliada sem quebra de texto.
- Categorias de produto e totais em kg por categoria.
- Impressão da fila com data do pedido e resumo por categoria.
- Central de Prazos com agenda diária por capacidade da máquina.
- Capacidade inicial da EF1 em 2.500 kg por 24 horas.
- Divisão automática de pedidos entre os dias de produção.

## Publicação

1. Extraia o ZIP no computador.
2. Envie o conteúdo da pasta extraída para a raiz da branch `main` do GitHub.
3. Substitua os arquivos existentes com os mesmos nomes.
4. Não envie o arquivo ZIP, a pasta `node_modules` nem a pasta `.next`.
5. Aguarde a Vercel concluir o deploy automático.

## Configuração da Vercel

- Framework Preset: `Next.js`
- Build Command: padrão (`npm run build`)
- Output Directory: vazio
- Install Command: padrão
- Root Directory: vazio

## Desenvolvimento local

```bash
npm install
npm run dev
```
