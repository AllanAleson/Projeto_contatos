# Projeto Contatos — Expo + TypeScript + API MongoDB

Projeto baseado no PDF **App Contatos com Auth v3 2.pdf**. Inclui o aplicativo e uma API compatível, para não depender de um backend não fornecido no material.

## O que foi implementado

- Cadastro e login com senha criptografada por hash bcrypt e JWT com duração de 7 dias.
- Rotas protegidas com Expo Router e encerramento da sessão em respostas 401.
- Token em SecureStore no Android/iOS. No navegador, sessionStorage (a sessão termina ao fechar a aba; não possui a mesma proteção do SecureStore).
- Listar, buscar, cadastrar, editar e excluir contatos com confirmação.
- Nome obrigatório; telefone, e-mail, endereço e foto opcionais.
- Seleção de foto, prévia, upload multipart no campo `foto`, armazenamento no GridFS e exibição autenticada.
- Remoção da associação da foto usando `fotoId: null`.
- Mensagens de erro, carregamento, lista vazia e prevenção de envio repetido no formulário.
- Contatos e fotos privados por usuário, limite de imagem de 5 MB e validação dos bytes de JPG/PNG/WebP.

## 1. Preparar

Instale **Node.js 22.13 ou superior** (Node 24 também funciona). Para o banco, use Docker Desktop ou uma instância MongoDB sua.

Extraia o ZIP, abra a pasta `projeto-contatos` no VS Code e execute no terminal dessa pasta:

```powershell
npm ci
npm run setup
```

O setup cria `api/.env` com uma chave JWT aleatória e `app-contatos/.env` com o endereço da API. Ele não sobrescreve configurações existentes. Não envie o `.env` para o Git.

## 2. Ligar o MongoDB

Com o Docker Desktop aberto, na pasta principal:

```powershell
docker compose up -d
```

O volume mantém os dados entre reinicializações. O banco fica acessível somente pelo próprio PC. Para parar sem apagar os dados, use `docker compose stop`.

Se já usa MongoDB local ou Atlas, não precisa do Docker. Ajuste `MONGODB_URI` em `api/.env` com a sua conexão; inclua o nome do banco no caminho. Nenhuma conta ou credencial de banco externo foi criada para você.

## 3. Iniciar a API

No primeiro terminal, na pasta principal:

```powershell
npm run api
```

Mantenha esse terminal aberto. A API informa `http://localhost:3000`. Abra `http://localhost:3000/health`: deve aparecer `{"status":"ok"}`.

## 4. Abrir o aplicativo

### Navegador — caminho mais direto para testar

Abra um segundo terminal na pasta principal:

```powershell
npm run web
```

Acesse o endereço mostrado pelo Expo, normalmente `http://localhost:8081`. Clique em **Criar uma conta**, cadastre-se e depois faça login. Não há usuário ou senha padrão.

### Android/iOS

Antes de iniciar, ajuste `EXPO_PUBLIC_API_URL` em `app-contatos/.env`:

| Onde o app roda                    | URL da API              |
| ---------------------------------- | ----------------------- |
| Navegador no próprio PC            | `http://localhost:3000` |
| Emulador Android do Android Studio | `http://10.0.2.2:3000`  |
| Simulador iOS no Mac               | `http://localhost:3000` |
| Celular físico                     | `http://IP_DO_PC:3000`  |

No Windows, use `ipconfig` para encontrar o IPv4 da conexão Wi-Fi. Exemplo de configuração: `EXPO_PUBLIC_API_URL=http://192.168.0.10:3000`. Use o IP real da sua máquina. Celular e PC precisam estar na mesma rede, e o firewall deve permitir a API na rede privada. Primeiro teste `/health` no navegador do celular.

Depois:

```powershell
npm run app
```

O projeto está fixado no **Expo SDK 55**. Use uma versão do Expo Go compatível com esse SDK, ou um development build. O Expo Go instalado na loja pode exigir outro SDK. Para emulador Android, com o ambiente Android configurado, pressione `a`. Não foi gerado APK/IPA neste pacote.

Após mudar o `.env`, reinicie o Expo; se precisar limpar o cache:

Dentro de `app-contatos`, execute:

```powershell
npx expo start --clear
```

## Estrutura

```text
projeto-contatos/
  app-contatos/
    app/_layout.tsx          Provedor e proteção das rotas
    app/index.tsx            Login
    app/cadastro.tsx         Cadastro
    app/contatos/            Lista, novo e edição
    components/FormContato.tsx
    components/Foto.tsx      Imagem autenticada no nativo e na web
    components/UI.tsx        Campos, botões e mensagens
    lib/api.ts               Axios e armazenamento do token
    lib/auth.tsx             Estado da sessão
    styles/global.ts
    types/Contato.ts
  api/src/app.js             Rotas, validação, JWT, CRUD e GridFS
  api/src/server.js          Conexão e servidor
  api/test/api.test.js       Testes de integração
  scripts/setup.mjs          Configuração local sem segredos fixos
  compose.yaml              MongoDB com volume persistente
  package-lock.json         Dependências fixadas
```

## Rotas da API

Todas as rotas privadas usam `Authorization: Bearer SEU_TOKEN`.

| Método | Rota                  | Acesso / resultado                                 |
| ------ | --------------------- | -------------------------------------------------- |
| GET    | `/health`             | Público; servidor ligado                           |
| POST   | `/usuarios/registrar` | Público; `{ nome, email, senha }`                  |
| POST   | `/usuarios/login`     | Público; `{ email, senha }` → `{ token, usuario }` |
| GET    | `/usuarios/me`        | Privado; usuário atual                             |
| GET    | `/contatos`           | Privado; lista do usuário                          |
| GET    | `/contatos/:id`       | Privado; um contato                                |
| POST   | `/contatos`           | Privado; criar                                     |
| PUT    | `/contatos/:id`       | Privado; substituir os campos editáveis            |
| DELETE | `/contatos/:id`       | Privado; excluir                                   |
| POST   | `/upload`             | Privado; multipart `foto` → `{ fileId }`           |
| GET    | `/upload/:id`         | Privado; imagem do dono                            |
| DELETE | `/upload/:id`         | Privado; apagar imagem sem contato associado       |

O PUT recebe `nome`, `telefone`, `email`, `endereco` e `fotoId`, como o formulário. Omitir um campo opcional o limpa. Campos adicionais e tentativa de informar `usuarioId` são rejeitados.

Remover a foto do contato ou excluir um contato **não apaga automaticamente o arquivo físico do GridFS**. Isso evita apagar imagens ainda referenciadas. A rota DELETE de upload permite apagar um arquivo sem uso. Uploads abandonados são mantidos; não há rotina automática de limpeza neste projeto didático.

## Validação

```powershell
npm run check
npm test
npm run export:web --workspace app-contatos
```

- `check`: TypeScript do app e sintaxe do backend.
- `test`: 10 testes de integração com MongoDB temporário real, separado do banco de uso. O primeiro uso pode baixar o executável do MongoDB. Não mexe nos seus contatos.
- `export:web`: gera `app-contatos/dist`.

**Resultado durante a entrega:** checagem de TypeScript/sintaxe e exportação web concluídas. Dependências conferidas com a tabela local do SDK. Os testes de integração foram tentados, mas o ambiente bloqueou a inicialização do MongoDB com `Operation not permitted`; por isso o fluxo completo com banco não foi validado aqui. Android/iOS não foram executados em dispositivo. A conferência interativa no navegador também não foi concluída: o processo de automação não iniciou neste ambiente. A exportação web foi validada pelo compilador, sem alegação de teste visual ou de fluxo ponta a ponta.

## Diferenças e correções em relação ao PDF

- Backend incluído, pois o material pressupunha uma API já existente.
- Proteção declarativa `Stack.Protected`, evitando navegar antes de montar o roteador.
- `useFocusEffect` com `useCallback` estável, sem chamadas repetidas em todo render.
- Upload tratado separadamente no navegador e no React Native; boundary definido automaticamente.
- Fotos privadas: header no nativo, Blob autenticado na web.
- Remoção envia `null`; `undefined` desapareceria do JSON.
- Edição mostra erro e permite tentar novamente, em vez de manter um spinner infinito.
- Sair, busca e confirmação de exclusão adicionados.

## Problemas comuns

- **Não conecta:** confirme MongoDB, terminal da API, `/health` e URL no `.env`.
- **Web em outra porta/origem:** acrescente a origem exata em `CORS_ORIGINS` no `.env` da API, separada por vírgulas, e reinicie a API. `localhost` e `127.0.0.1` são origens diferentes.
- **Foto não abre na barra do navegador:** a rota exige token; o app já envia a autenticação.
- **401:** entre novamente; o token expira em 7 dias.
- **Upload rejeitado:** use JPG/PNG/WebP até 5 MB; HEIC não é aceito diretamente.
- **E-mail já cadastrado:** faça login ou use outro e-mail.
- **Porta 3000 ocupada:** altere `PORT` na API e atualize a URL do app.

Projeto preparado para execução local didática. Publicação na internet exige configuração de infraestrutura, HTTPS, segredos e banco próprios.

## Referências técnicas

- Material fornecido: `App Contatos com Auth v3 2.pdf`.
- Expo SDK: https://docs.expo.dev/versions/v55.0.0/
- Expo Router/autenticação: https://docs.expo.dev/router/advanced/authentication/
- Image Picker: https://docs.expo.dev/versions/v55.0.0/sdk/imagepicker/
