# ajuda-mentor

Mod do Claude Code para mentorados da VAMOO AI. Quando você trava numa sessão, `/ajuda-mentor` resume a conversa num pedido de ajuda, esconde chaves e dados pessoais, mostra a prévia e só envia ao grupo da mentoria quando você confirma.

## Instalação

No terminal, com o `claude` aberto:

```
/plugin install ajuda-mentor --marketplace VAMOO-AI/ajuda-mentor
```

Responda `y` para adicionar o marketplace e escolha o escopo de usuário com Enter. Na tela seguinte, preencha:

- **Endereço do webhook da mentoria:** a URL que o mentor te passou.
- **Seu token pessoal:** o token que o mentor gerou para você.

Pelo shell, sem abrir o `claude`:

```
claude plugin install ajuda-mentor --marketplace VAMOO-AI/ajuda-mentor
```

No app desktop, onde `/plugin` não roda: clique no + ao lado da caixa do prompt, depois em Plugins, Add marketplace com `VAMOO-AI/ajuda-mentor` e Add plugin. Instalado pelo terminal no escopo de usuário, o mod também funciona no desktop.

O token é pessoal. Não coloque no grupo, num repositório ou num print. Se vazar, avise o mentor para ele trocar.

## Uso

| Comando | O que faz |
|---|---|
| `/ajuda-mentor` | Resume o problema da conversa atual e mostra a prévia |
| `/ajuda-mentor o deploy dá 401` | O mesmo, partindo da sua descrição |
| `/ajuda-mentor enviar ABCD` | Envia a prévia de código ABCD, quando não há painel para clicar |
| `/ajuda-mentor cancelar` | Descarta a prévia sem enviar nada |

O pedido vem neste formato: Título, Objetivo, O que já tentei, Erro e Onde travou, com no máximo 1500 caracteres. No painel, revise e aperte **Enviar ao mentor**. O texto enviado é exatamente o da prévia, uma vez só.

## O que sai do seu computador

Nada sai até você confirmar. Quando confirma, vai um POST para o webhook da mentoria com:

- o texto da prévia, já mascarado;
- o nome da pasta do projeto (não o caminho completo) e a branch atual.

Antes da prévia, o mod troca por marcadores: credenciais em URL, tokens Bearer e JWT, chaves `sk-`, `ghp_`, `github_pat_`, AWS e Slack, valores de `VARIAVEL=valor`, e-mails e telefones. A máscara é de melhor esforço. Leia a prévia antes de enviar.

O formato da requisição e das respostas está em [CONTRATO-webhook.md](CONTRATO-webhook.md).

## Desenvolvimento

```
claude plugin validate .
claude plugin test .
```

## Licença

[MIT](LICENSE)
