import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { mascarar } from '../hooks/mascara'

const RESUMO = [
  'Título: Deploy da edge function falha com 401',
  'Objetivo: publicar a função de webhook',
  'O que já tentei:',
  '- rodei supabase functions deploy com SUPABASE_SERVICE_ROLE_KEY=abc123def456ghi789',
  '- mandei o header Bearer abcdefghijklmnopqrstuv',
  'Erro: 401 ao chamar, contato do cliente joao@cliente.com.br e (11) 98765-4321',
  'Onde travou: supabase/functions/webhook',
].join('\n')

const OPCOES = { options: { webhook_url: 'https://n8n.exemplo.test/webhook/ajuda', token: 'tok-pessoa-1' } }

const PANE = {
  plugin: 'ajuda-mentor',
  component: 'Pane',
  requestId: 'ajuda-mentor',
  props: {
    title: 'Pedido de ajuda ao mentor',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

type Post = { url: string; headers: Record<string, string>; body: string }

// O que fica abaixo do plugin: cada hook aqui faz o papel do engine.
const motor = (on: On, opcoes: { forkTexto?: string; status?: number; isPlaced?: boolean } = {}) => {
  const posts: Post[] = []
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({
    value: opcoes.isPlaced === false ? { isPlaced: false as const, reason: 'sem painel nesta superfície' } : { isPlaced: true as const },
  }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: 'feat/webhook\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('model.fork', () => ({
    value: { isAnswered: true, text: opcoes.forkTexto ?? RESUMO, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  }))
  on('http.fetch', (_, e) => {
    const init = (e as { init?: { headers?: Record<string, string>; body?: string } }).init ?? {}
    posts.push({ url: String((e as { url: string }).url), headers: init.headers ?? {}, body: init.body ?? '' })
    const status = opcoes.status ?? 200
    return { value: { status, ok: status < 300, headers: {}, text: '{"ok":true}' } }
  })
  return posts
}

const iniciar = async ($: Engine) =>
  $.session.start({ cwd: '/Users/fulano/WORKSPACES/app-cliente', surface: 'desktop', isInteractive: true })

// O comando como a pessoa digita: `/ajuda-mentor <args>`.
const rodar = async ($: Engine, args: string): Promise<string> => {
  const resultado = await $.command.run({
    command: 'ajuda-mentor',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
  return resultado.text ?? ''
}

test('a máscara pega chave, token, e-mail e telefone', () => {
  const { texto, mascarados } = mascarar(RESUMO)
  expect(texto).not.toContain('abc123def456ghi789')
  expect(texto).not.toContain('abcdefghijklmnopqrstuv')
  expect(texto).not.toContain('joao@cliente.com.br')
  expect(texto).not.toContain('98765-4321')
  expect(texto).toContain('SUPABASE_SERVICE_ROLE_KEY=[valor]')
  expect(mascarados).toBe(4)
})

test('gerar a prévia não envia nada', OPCOES, async ($, on) => {
  const posts = motor(on)
  await iniciar($)
  const r = await rodar($, '')
  expect(posts.length).toBe(0)
  expect(r).toContain('Pedido de ajuda · código')
  expect(r).toContain('Projeto: app-cliente')
  expect(r).not.toContain('fulano')
  expect(r).not.toContain('joao@cliente.com.br')
})

test('o botão envia exatamente o rascunho da prévia, uma vez só', OPCOES, async ($, on) => {
  const posts = motor(on)
  await iniciar($)
  await rodar($, '')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      await ui.press({ key: 'enviar' })
      expect(posts.length).toBe(1)
    } else {
      expect(await ui.find({ key: 'enviar' })).toBe(undefined)
    }
    await ui.unmount()
  }

  const post = posts[0]
  expect(post?.url).toBe('https://n8n.exemplo.test/webhook/ajuda')
  expect(post?.headers.Authorization).toBe('Bearer tok-pessoa-1')
  const corpo = JSON.parse(post?.body ?? '{}') as { versao: number; rascunho: { id: string; texto: string; repo: string; branch: string } }
  expect(corpo.versao).toBe(1)
  expect(corpo.rascunho.repo).toBe('app-cliente')
  expect(corpo.rascunho.branch).toBe('feat/webhook')
  expect(corpo.rascunho.texto).not.toContain('joao@cliente.com.br')
  expect(post?.headers['Idempotency-Key']).toBe(corpo.rascunho.id)

  const deNovo = await rodar($, `enviar ${corpo.rascunho.id.replace(/[^A-Za-z0-9]/g, '').slice(-4)}`)
  expect(deNovo).toContain('já foi enviado')
  expect(posts.length).toBe(1)
})

test('sem painel, só envia com o código certo', OPCOES, async ($, on) => {
  const posts = motor(on, { isPlaced: false })
  await iniciar($)
  const previa = await rodar($, '')
  const codigo = previa.match(/código (\w{4})/)?.[1] ?? ''
  expect(previa).toContain(`/ajuda-mentor enviar ${codigo}`)

  const errado = await rodar($, 'enviar ZZZZ')
  expect(errado).toContain('não confere')
  expect(posts.length).toBe(0)

  const certo = await rodar($, `enviar ${codigo.toLowerCase()}`)
  expect(certo).toContain('enviado ao mentor')
  expect(posts.length).toBe(1)
})

test('sem token configurado, não envia e explica', { options: { webhook_url: '', token: '' } }, async ($, on) => {
  const posts = motor(on, { isPlaced: false })
  await iniciar($)
  const previa = await rodar($, '')
  const codigo = previa.match(/código (\w{4})/)?.[1] ?? ''
  const r = await rodar($, `enviar ${codigo}`)
  expect(r).toContain('Configure o endereço do webhook')
  expect(posts.length).toBe(0)
})

test('erro HTTP mantém o rascunho e permite tentar de novo', OPCOES, async ($, on) => {
  const posts = motor(on, { isPlaced: false, status: 401 })
  await iniciar($)
  const previa = await rodar($, '')
  const codigo = previa.match(/código (\w{4})/)?.[1] ?? ''
  const r = await rodar($, `enviar ${codigo}`)
  expect(r).toContain('token recusado')
  const outra = await rodar($, `enviar ${codigo}`)
  expect(outra).toContain('token recusado')
  expect(posts.length).toBe(2)
})

test('cancelar descarta e nada sai', OPCOES, async ($, on) => {
  const posts = motor(on, { isPlaced: false })
  await iniciar($)
  const previa = await rodar($, '')
  const codigo = previa.match(/código (\w{4})/)?.[1] ?? ''
  await rodar($, 'cancelar')
  const r = await rodar($, `enviar ${codigo}`)
  expect(r).toContain('Não há pedido')
  expect(posts.length).toBe(0)
})
