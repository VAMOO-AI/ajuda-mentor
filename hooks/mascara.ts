// Máscara de melhor esforço antes da prévia. A prévia é o portão de verdade: o mentorado lê antes de enviar.
type Regra = { padrao: RegExp; troca: string }

const REGRAS: Regra[] = [
  { padrao: /:\/\/[^/\s:@]+:[^/\s@]+@/g, troca: '://[credencial]@' },
  { padrao: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g, troca: 'Bearer [token]' },
  { padrao: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, troca: '[token]' },
  { padrao: /\bsk-[A-Za-z0-9_-]{16,}/g, troca: '[chave]' },
  { padrao: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, troca: '[token]' },
  { padrao: /\bAKIA[0-9A-Z]{16}\b/g, troca: '[chave]' },
  { padrao: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, troca: '[token]' },
  { padrao: /\b([A-Z][A-Z0-9_]{2,})\s*=\s*['"]?[^\s'"]{12,}['"]?/g, troca: '$1=[valor]' },
  { padrao: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, troca: '[e-mail]' },
  { padrao: /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9\d{4}[-\s]?\d{4}\b/g, troca: '[telefone]' },
]

export const mascarar = (texto: string): { texto: string; mascarados: number } => {
  let mascarados = 0
  const limpo = REGRAS.reduce((atual, { padrao, troca }) => {
    return atual.replace(padrao, (...m) => {
      mascarados += 1
      // `$1` mantém só o nome da variável de ambiente.
      return troca.replace('$1', String(m[1] ?? ''))
    })
  }, texto)

  return { texto: limpo, mascarados }
}
