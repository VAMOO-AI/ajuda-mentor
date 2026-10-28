# Contrato do webhook do `/ajuda-mentor` (versão 1)

O mod só chama o webhook depois que o mentorado aperta **Enviar ao mentor** ou digita `/ajuda-mentor enviar <código>`. O corpo é o rascunho exatamente como apareceu na prévia, já mascarado.

## Requisição

`POST <webhook_url>` (configurado no mod)

| Header | Valor |
|---|---|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <token da pessoa>` |
| `Idempotency-Key` | o mesmo valor de `rascunho.id` |

```json
{
  "versao": 1,
  "rascunho": {
    "id": "3f2b…-uuid",
    "codigo": "A1B2",
    "titulo": "Deploy da edge function falha com 401",
    "texto": "Título: …\nObjetivo: …\nO que já tentei:\n- …\nErro: …\nOnde travou: …",
    "repo": "app-cliente",
    "branch": "feat/webhook",
    "criadoEm": "2026-10-27T18:00:00.000Z",
    "mascarados": 3
  }
}
```

- `texto` tem no máximo 1500 caracteres. `repo` é só o nome da pasta. `repo` e `branch` podem vir `null`.
- O token identifica a pessoa. O n8n não deve aceitar nome, grupo ou destino vindo no corpo.

## O que o n8n faz

1. Lê o token do `Authorization` e procura o hash dele na tabela de tokens. Não encontrou ou está revogado: responde `401`.
2. Se já processou um `Idempotency-Key` igual, responde `200` com o resultado anterior e não envia de novo.
3. Monta a mensagem para o grupo do mentorado: nome dele (vindo da tabela), `titulo`, `texto`, `repo`/`branch`.
4. Envia ao grupo de WhatsApp ligado ao token. Antes da primeira vez num grupo real, roda em modo de teste (dry-run) para um número interno.
5. Registra o pedido (id, pessoa, horário, status) e responde.

## Respostas

| Status | Quando | Corpo |
|---|---|---|
| `200` | enviado (ou repetição de um id já enviado) | `{ "ok": true, "id": "<rascunho.id>" }` |
| `400` | corpo fora do formato ou `versao` desconhecida | `{ "ok": false, "erro": "formato" }` |
| `401` | token ausente, desconhecido ou revogado | `{ "ok": false, "erro": "token" }` |
| `413` | `texto` acima de 1500 caracteres | `{ "ok": false, "erro": "tamanho" }` |
| `429` | mais de 5 pedidos da mesma pessoa em 10 minutos | `{ "ok": false, "erro": "limite" }` |
| `502` | o envio ao WhatsApp falhou | `{ "ok": false, "erro": "whatsapp" }` |

O mod trata `401` e `403` como "token recusado". Qualquer outro status que não seja `2xx` vira "erro N", e o rascunho continua na sessão para a pessoa tentar de novo.

## Fora desta versão

A entrega na página da Sala do projeto (fase 2) depende de a Sala ganhar a capability `db` e de definir de quem é a página. Ela não passa por este webhook.
