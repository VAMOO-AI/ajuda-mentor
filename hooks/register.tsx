import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelForkResult, Register } from 'claude-code'

import type { Etapa, Rascunho } from '../types'
import { montarRascunho, pedidoDoResumo, repoDe, SEM_PROBLEMA } from './rascunho'

type Config = { webhookUrl: string; token: string }

const PANE = 'ajuda-mentor'
const rascunho = atom({ plugin: 'ajuda-mentor', key: 'rascunho' } as const, null)
const etapa = atom({ plugin: 'ajuda-mentor', key: 'etapa' } as const, 'livre')
const aviso = atom({ plugin: 'ajuda-mentor', key: 'aviso' } as const, null)
const enviados = atom({ plugin: 'ajuda-mentor', key: 'enviados' } as const, [])
const repo = atom({ plugin: 'ajuda-mentor', key: 'repo' } as const, null)
const cwd = atom({ plugin: 'ajuda-mentor', key: 'cwd' } as const, null)

const MOTIVO_FORK: Record<string, string> = {
  'nothing-to-fork': 'Ainda não há conversa para resumir. Descreva o problema: /ajuda-mentor <o que está travando>.',
  aborted: 'O resumo foi interrompido. Rode /ajuda-mentor de novo.',
  'api-error': 'O modelo não respondeu (erro da API). Tente de novo em instantes.',
  'empty-reply': 'O modelo voltou sem texto. Rode /ajuda-mentor de novo, se puder com uma descrição.',
}

const previa = (r: Rascunho): string =>
  [
    `Pedido de ajuda · código ${r.codigo}`,
    `Projeto: ${r.repo ?? '-'} · branch: ${r.branch ?? '-'}`,
    r.mascarados > 0 ? `${r.mascarados} trecho(s) mascarado(s) antes da prévia.` : 'Nada precisou ser mascarado.',
    '',
    r.texto,
  ].join('\n')

async function definirEtapa($: EngineInterface, nova: Etapa, texto: string | null): Promise<void> {
  await update($, etapa, () => nova)
  await update($, aviso, () => texto)
}

async function descartar($: EngineInterface, texto: string | null): Promise<void> {
  await update($, rascunho, () => null)
  await definirEtapa($, 'livre', texto)
}

// Única saída de dados do mod. Só é chamada pelo botão da prévia ou pelo /ajuda-mentor enviar <código>.
async function enviar($: EngineInterface, config: Config): Promise<string> {
  const r = await read($, rascunho)
  if (!r) return 'Não há pedido para enviar. Rode /ajuda-mentor primeiro.'
  if ((await read($, etapa)) === 'enviando') return 'O envio já está em andamento.'
  if ((await read($, enviados)).includes(r.id)) return `O pedido ${r.codigo} já foi enviado.`
  if (!config.webhookUrl || !config.token) {
    const falta = 'Configure o endereço do webhook e o seu token nas opções do mod ajuda-mentor antes de enviar.'
    await definirEtapa($, 'erro', falta)
    return falta
  }

  await definirEtapa($, 'enviando', null)
  try {
    const resposta = await $.http.fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        'Idempotency-Key': r.id,
      },
      body: JSON.stringify({ versao: 1, rascunho: r }),
    })
    if (!resposta.ok) {
      const motivo = resposta.status === 401 || resposta.status === 403 ? 'token recusado' : `erro ${resposta.status}`
      const texto = `O envio falhou (${motivo}). O pedido continua aqui; tente de novo ou fale com o mentor.`
      await definirEtapa($, 'erro', texto)
      $.ui.toast(texto)
      return texto
    }
    await update($, enviados, lista => [...lista, r.id].slice(-50))
    const ok = `Pedido ${r.codigo} enviado ao mentor.`
    await definirEtapa($, 'enviado', ok)
    $.ui.toast(ok)
    return ok
  } catch (erro) {
    const texto = `A rede recusou o envio (${erro instanceof Error ? erro.message : 'motivo desconhecido'}). O pedido continua aqui.`
    await definirEtapa($, 'erro', texto)
    $.ui.toast(texto)
    return texto
  }
}

async function branchAtual($: EngineInterface, pasta: string | null): Promise<string | null> {
  if (!pasta) return null
  try {
    const r = await $.process.run(['git', '-C', pasta, 'rev-parse', '--abbrev-ref', 'HEAD'])
    return r.exitCode === 0 ? r.stdout.trim() || null : null
  } catch {
    return null // sem git ou sem $.process nesta superfície: segue sem branch
  }
}

async function resumir($: EngineInterface, descricao: string): Promise<ModelForkResult> {
  const r = await $.model.fork({ prompt: pedidoDoResumo(descricao) })
  if (r.isAnswered || r.reason !== 'nothing-to-fork' || !descricao) return r
  // Sessão nova ou retomada: o fork ainda não tem conversa, então o resumo sai só da descrição.
  return $.model.complete({ model: 'haiku', prompt: pedidoDoResumo(descricao, 'descricao') })
}

async function gerar($: EngineInterface, descricao: string): Promise<string> {
  await definirEtapa($, 'gerando', null)
  const resposta = await resumir($, descricao)
  if (!resposta.isAnswered) {
    const texto = MOTIVO_FORK[resposta.reason] ?? `Não consegui montar o resumo (${resposta.reason}).`
    await definirEtapa($, 'erro', texto)
    return texto
  }
  if (resposta.text.trim() === SEM_PROBLEMA) {
    const texto = 'Não achei um problema nesta conversa. Descreva: /ajuda-mentor <o que está travando>.'
    await definirEtapa($, 'livre', texto)
    return texto
  }

  const novo = montarRascunho({
    id: crypto.randomUUID(),
    resumo: resposta.text,
    repo: await read($, repo),
    branch: await branchAtual($, await read($, cwd)),
    criadoEm: new Date(await $.clock.now()).toISOString(),
  })
  await update($, rascunho, () => novo)
  await definirEtapa($, 'pronto', null)
  const { isPlaced } = await $.ui.open({ id: PANE, title: 'Pedido de ajuda ao mentor' })

  return [
    previa(novo),
    '',
    isPlaced
      ? 'Revise no painel e aperte Enviar ao mentor. Nada sai sem esse clique.'
      : `Nada foi enviado. Para enviar exatamente este texto: /ajuda-mentor enviar ${novo.codigo}. Para descartar: /ajuda-mentor cancelar.`,
  ].join('\n')
}

export const register: Register = (on, options) => {
  const config: Config = {
    webhookUrl: String(options.webhook_url ?? '').trim(),
    token: String(options.token ?? '').trim(),
  }

  on('session.start', async ($, e, next) => {
    await update($, cwd, () => e.cwd ?? null)
    await update($, repo, () => repoDe(e.cwd))
    await $.command.register({
      name: 'ajuda-mentor',
      description: 'Monta um pedido de ajuda ao mentor com prévia; só envia quando você confirma',
      argumentHint: '[o que está travando] | enviar <código> | cancelar',
    })

    return next(e)
  })

  on('command.run', { command: 'ajuda-mentor' }, async ($, e) => {
    const [acao, codigo] = e.args.trim().split(/\s+/)

    if (acao === 'cancelar') {
      await descartar($, null)
      await $.ui.close({ id: PANE })
      return { text: 'Pedido descartado. Nada foi enviado.' }
    }

    if (acao === 'enviar') {
      const r = await read($, rascunho)
      if (!r) return { text: 'Não há pedido para enviar. Rode /ajuda-mentor primeiro.' }
      if ((codigo ?? '').toUpperCase() !== r.codigo) {
        return { text: `O código não confere com o pedido da prévia (${r.codigo}). Nada foi enviado.` }
      }
      return { text: await enviar($, config) }
    }

    return { text: await gerar($, e.args.trim()) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const r = await read($, rascunho)
    const agora = await read($, etapa)
    const msg = await read($, aviso)

    if (!r) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{agora === 'gerando' ? 'Montando o resumo da conversa...' : msg ?? 'Nenhum pedido em preparo. Rode /ajuda-mentor.'}</Text>
        </Box>
      )
    }

    const isEnviado = agora === 'enviado'
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          Código {r.codigo} · {r.repo ?? '-'} · {r.branch ?? '-'} · {r.mascarados} mascarado(s)
        </Text>
        <Markdown key="previa" text={r.texto} />
        {msg && <Text color={agora === 'erro' ? 'red' : undefined}>{msg}</Text>}
        <Box gap={2}>
          {!isEnviado && (
            <Button
              key="enviar"
              variant="primary"
              label={agora === 'enviando' ? 'Enviando...' : 'Enviar ao mentor'}
              onPress={() => enviar($, config)}
            />
          )}
          <Button
            key="descartar"
            label={isEnviado ? 'Fechar' : 'Descartar'}
            onPress={() => descartar($, isEnviado ? msg : 'Pedido descartado. Nada foi enviado.')}
          />
        </Box>
      </Box>
    )
  })
}
