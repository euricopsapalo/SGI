# Changelog

Todas as alterações notáveis a este projeto serão documentadas neste ficheiro.

## [Não publicado]

### RF-OT-001 — Ciclo de vida e máquina de estados da OT (closes #54)

**Backend**
- `OTEstado` passa de 4 para 6 estados: `Registada → Programada → Adiada → Confirmada → Em execução → Finalizada`.
- `OTTipo` renomeado: `programada` → `periodica` (mantém `pontual`).
- Nova coluna `assinada_cliente` em `ordens_trabalho`.
- Guarda central `assertTransicao` + matriz `OT_TRANSICOES`; transições inválidas devolvem **HTTP 422**.
- Novos endpoints de transição: `PUT /ordens/:id/{agendar,confirmar,adiar,iniciar,finalizar}`.
- Aliases descontinuados (`emitir/terminar/encerrar/reverter`) devolvem **HTTP 410 Gone**.
- Cada transição regista entrada em `sys_logs` (`OT_TRANSICAO`).
- `GET /ordens` e `GET /ordens/:id` incluem `transicoesPossiveis`.
- Migration `ReformularEstadosOT` (up/down) com mapeamento dos 4 estados legados; `init.sql` atualizado (default `Registada`, CHECK constraint, coluna `assinada_cliente`).

**Frontend**
- Tipos `OTEstado`/`OTTipo` atualizados; helpers `OT_TRANSICOES`, `OT_ESTADO_COR`, `normEstado` (mapeia dados legados).
- Métodos de contexto `agendarOT/confirmarOT/adiarOT/iniciarOT/finalizarOT` substituem `emitirOT/terminarOT/encerrarOT/reverterOT`.
- OrdensPage: badges com 6 cores; ações dinâmicas geradas por `transicoesPossiveis` (modal + menu de contexto).
- AgendaPage: cores por estado; arrastar permitido apenas em `Programada`/`Adiada`.
- Dashboard, Técnicos, Parque, Clientes, Faturação, Relatórios atualizados para o novo modelo.

**Testes**
- Unit (`ordens-trabalho.service.spec.ts`): transições válidas/ inválidas + `sys_logs`.
- E2E (`ot-ciclo-estados.e2e.spec.ts`): fluxo feliz, 422 em saltos, 410 nos aliases, `transicoesPossiveis`.
- DTOs e e2e existentes migrados para os novos enums.
