// O pedido como foi mostrado na prévia. É este objeto, sem mudança, que vai no POST.
export type Rascunho = {
  id: string
  codigo: string
  titulo: string
  texto: string
  repo: string | null
  branch: string | null
  criadoEm: string
  mascarados: number
}

export type Etapa = 'livre' | 'gerando' | 'pronto' | 'enviando' | 'enviado' | 'erro'

declare module 'claude-code' {
  interface PluginState {
    'ajuda-mentor': {
      rascunho: Rascunho | null
      etapa: Etapa
      aviso: string | null
      enviados: string[]
      repo: string | null
      cwd: string | null
    }
  }
}
