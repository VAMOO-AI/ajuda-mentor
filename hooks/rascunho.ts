import type { Rascunho } from '../types'
import { mascarar } from './mascara'

export const LIMITE_TEXTO = 1500

export const SEM_PROBLEMA = 'SEM_PROBLEMA'

export const pedidoDoResumo = (descricao: string): string =>
  [
    'Escreva, em português, um pedido de ajuda que o mentorado vai mandar ao mentor sobre o problema desta conversa.',
    descricao ? `O mentorado descreveu assim: "${descricao}".` : '',
    'Formato, nesta ordem e sem nada antes:',
    'Título: <uma linha>',
    'Objetivo: <o que ele quer fazer>',
    'O que já tentei: <até 4 itens curtos, um por linha, começando com "- ">',
    'Erro: <a mensagem de erro principal, sem stack trace inteiro; "nenhum" se não houver>',
    'Onde travou: <arquivo ou comando, sem o conteúdo>',
    'Regras: no máximo 1200 caracteres. Não copie conteúdo de arquivos, valores de variáveis de ambiente, chaves, tokens, nem nomes, e-mails ou telefones de clientes.',
    `Se a conversa não tiver um problema para pedir ajuda, responda só ${SEM_PROBLEMA}.`,
  ]
    .filter(Boolean)
    .join('\n')

export const tituloDe = (texto: string): string => {
  const linha = texto.match(/^Título:\s*(.+)$/m)?.[1] ?? texto.split('\n')[0] ?? ''
  const t = linha.trim()
  return t.length > 90 ? `${t.slice(0, 87)}...` : t || 'Pedido de ajuda'
}

// O código curto confirma, no /ajuda-mentor enviar <código>, que a pessoa está enviando ESTE rascunho.
export const codigoDe = (id: string): string => id.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()

export const montarRascunho = (args: {
  id: string
  resumo: string
  repo: string | null
  branch: string | null
  criadoEm: string
}): Rascunho => {
  const cortado = args.resumo.trim().slice(0, LIMITE_TEXTO)
  const { texto, mascarados } = mascarar(cortado)
  return {
    id: args.id,
    codigo: codigoDe(args.id),
    titulo: tituloDe(texto),
    texto,
    repo: args.repo,
    branch: args.branch ? mascarar(args.branch).texto : null,
    criadoEm: args.criadoEm,
    mascarados,
  }
}

// Só o nome da pasta: o caminho inteiro carrega o usuário do macOS e a estrutura de pastas.
export const repoDe = (cwd: string | null | undefined): string | null => {
  if (!cwd) return null
  const nome = cwd.replace(/\/+$/, '').split('/').pop()
  return nome || null
}
