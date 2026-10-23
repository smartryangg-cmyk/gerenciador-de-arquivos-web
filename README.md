# Gerenciador de arquivos web

Navegue, envie, baixe, renomeie, mova e exclua arquivos de uma pasta do servidor pelo navegador.

- **Backend:** Node.js + Express (TypeScript), em `server/`
- **Frontend:** React + Vite (TypeScript), em `client/`
- **Armazenamento:** pasta local definida por `STORAGE_DIR`
- **Login:** um usuário administrador definido por variáveis de ambiente

## Rodando em desenvolvimento

```bash
npm run install:all
cd server && ADMIN_USER=admin ADMIN_PASSWORD=senha JWT_SECRET=dev npm run dev
# em outro terminal
cd client && npm run dev
```

Abra http://localhost:5173. O Vite repassa `/api` para o servidor na porta 3000.

## Produção

```bash
npm run install:all
npm run build
ADMIN_USER=... ADMIN_PASSWORD=... JWT_SECRET=... STORAGE_DIR=/caminho/dos/arquivos npm start
```

O servidor entrega a interface compilada e a API na mesma porta (`PORT`, padrão 3000). Veja `.env.example`.

## Testes

```bash
npm test
```
