# Painel de Produção — versão organizada

Esta versão mantém a interface, as regras e a conexão existentes, mas separa o projeto em arquivos menores para facilitar manutenção e crescimento.

## Estrutura

- `index.html`: estrutura das telas.
- `assets/styles.css`: aparência e responsividade.
- `assets/storage.js`: conexão e operações do app_storage.
- `assets/app.js`: regras do painel, formulários, relatórios e PCP.
- `painel-producao-versao-estavel.html`: cópia intacta para retorno imediato.

## Como testar

Abra um terminal nesta pasta e execute um servidor local simples, por exemplo:

`npx serve .`

Depois abra o endereço apresentado no navegador. Evite abrir apenas o `index.html` por duplo clique em produção; use hospedagem HTTPS.

## Segurança — próximo passo

A reorganização não altera as permissões do banco. Antes de disponibilizar o sistema para vários usuários, revisar no Supabase: autenticação, RLS da tabela `app_storage`, políticas por perfil e substituição futura da chave `anon` legada por uma chave publicável. Nunca colocar uma chave `service_role` ou secreta nestes arquivos.

## Retorno

Se qualquer comportamento diferir, use temporariamente `painel-producao-versao-estavel.html`. Os dados permanecem no mesmo banco e não são copiados nem apagados por esta reorganização.
